import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from '../automation/db.js';
import { submitJob, confirmUserSubmission } from '../automation/submission_engine.js';
import { defaultRegistry } from '../automation/providers/registry.js';
import { backupDatabase } from '../automation/backup_db.js';
import { startScheduler } from '../automation/scheduler.js';
import { launchSearchRun } from '../automation/search_run_launcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const generatedLettersDirectory = path.join(__dirname, '..', 'cover_letters', 'generated');
const port = Number(process.env.PORT || 4173);
const allowedLanguages = new Set(['fr', 'en', 'de']);
const cronPresetMap = {
    hourly: '0 * * * *',
    daily: '0 0 * * *',
    weekly: '0 8 * * 1-5'
};

function requiredText(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${label} est obligatoire.`);
    }
    return value.trim();
}

function optionalText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function parseProviderSelection(rawValue) {
    if (Array.isArray(rawValue)) return rawValue;
    if (typeof rawValue !== 'string' || !rawValue.trim()) return [];

    try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeCronExpression(rawValue, fallback = '0 * * * *') {
    const value = requiredText(rawValue, 'Expression cron').toLowerCase();
    if (cronPresetMap[value]) return cronPresetMap[value];

    const fields = value.split(/\s+/);
    if (fields.length === 5) {
        return value;
    }

    throw new Error('Expression cron invalide. Utilisez hourly, daily ou une expression cron 5 champs.');
}

async function withDb(operation) {
    const db = await initDb();
    return await operation(db);
}

function auth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Accès non autorisé.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide.' });
        req.user = user;
        next();
    });
}

function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '100kb' }));
    app.use(express.static(__dirname));

    let sseClients = [];

    function broadcast(event, data = {}) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        sseClients.forEach((client) => {
            try {
                client.res.write(payload);
            } catch {
                // Client connection might be closed
            }
        });
    }

    app.get('/api/events', (req, res) => {
        // Authentification optionnelle pour SSE (via header ou query param)
        const authHeader = req.headers['authorization'];
        let token = authHeader && authHeader.split(' ')[1];
        
        // Fallback: token via query parameter (pour EventSource qui ne supporte pas les headers)
        if (!token && req.query.token) {
            token = req.query.token;
        }
        
        let authenticated = false;
        
        if (token) {
            try {
                jwt.verify(token, JWT_SECRET);
                authenticated = true;
            } catch {
                // Client non authentifié, on continue quand même
            }
        }
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const clientId = Date.now() + Math.random();
        const newClient = { id: clientId, res, authenticated };
        sseClients.push(newClient);

        res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientId, authenticated })}\n\n`);

        req.on('close', () => {
            sseClients = sseClients.filter((c) => c.id !== clientId);
        });
    });

    app.get('/api/health', async (req, res) => {
        try {
            await withDb(async () => undefined);
            res.json({ status: 'ok', uptime: process.uptime() });
        } catch {
            res.status(503).json({ error: 'Base de données indisponible.' });
        }
    });

    app.get('/api/system/status', async (req, res) => {
        try {
            const stats = await withDb(async (db) => {
            const [jobsCount] = await db('jobs').count('id as count');
            const [runsCount] = await db('search_runs').count('id as count');
            // Prendre le dernier run terminé pour les statistiques
            const latestCompletedRun = await db('search_runs')
                .select('*')
                .whereIn('status', ['completed', 'failed'])
                .orderBy('finished_at', 'desc')
                .orderBy('id', 'desc')
                .first();
            // Prendre le dernier run (quel que soit son statut) pour l'état actuel
            const latestSearchRun = await db('search_runs').select('*').orderBy('created_at', 'desc').orderBy('id', 'desc').first();
            return {
                totalJobs: Number(jobsCount?.count || 0),
                totalSearchRuns: Number(runsCount?.count || 0),
                latestSearchRun: latestSearchRun || null,
                lastSearchAt: latestCompletedRun?.finished_at || latestSearchRun?.finished_at || latestSearchRun?.started_at || null,
                lastSearchStatus: latestCompletedRun?.status || latestSearchRun?.status || 'unknown',
                lastAnalyzedJobs: Number(latestCompletedRun?.analyzed_jobs_count || latestSearchRun?.analyzed_jobs_count || 0),
                lastNewJobs: Number(latestCompletedRun?.saved_jobs_count || latestSearchRun?.saved_jobs_count || 0)
            };
        });
            const providers = defaultRegistry.getMetadataList();
            const activeProviders = providers.filter(p => p.enabled).length;
            res.json({
                status: 'healthy',
                uptimeSeconds: Math.floor(process.uptime()),
                activeProviders,
                totalProviders: providers.length,
                ...stats,
                connectedClients: sseClients.length
            });
        } catch (error) {
            res.status(500).json({ status: 'unhealthy', error: error.message });
        }
    });

    app.post('/api/auth/register', async (req, res) => {
        try {
            const { email, password } = req.body;
            requiredText(email, 'Email');
            requiredText(password, 'Mot de passe');
            const hashedPassword = await bcrypt.hash(password, 10);
            await withDb((db) => db('users').insert({ email, password: hashedPassword }));
            res.status(201).json({ success: true });
        } catch (error) {
            if (error.message.includes('SQLITE_CONSTRAINT')) {
                res.status(409).json({ error: 'Utilisateur déjà existant.' });
            } else {
                res.status(500).json({ error: 'Erreur lors de l’enregistrement.' });
            }
        }
    });

    app.post('/api/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            requiredText(email, 'Email');
            requiredText(password, 'Mot de passe');
            const user = await withDb((db) => db('users').where({ email }).first());
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ error: 'Identifiants invalides.' });
            }
            const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token });
        } catch {
            res.status(500).json({ error: 'Erreur lors de la connexion.' });
        }
    });

    // Routes publiques (sans authentification)
    // /api/events, /api/health, /api/system/status, /api/auth/* sont publics
    
    // Routes protégées (authentification requise)
    app.use(['/api/jobs', '/api/cvs', '/api/profile', '/api/search', '/api/search-runs', '/api/providers', '/api/admin', '/api/schedules', '/api/search-configs'], auth);

    // Endpoints Recherches Planifiées
    app.get('/api/schedules', async (req, res) => {
        try {
            const schedules = await withDb((db) => db('scheduled_searches').select('*').orderBy('created_at', 'desc'));
            res.json(schedules);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les recherches planifiées.' });
        }
    });

    app.post('/api/schedules', async (req, res) => {
        try {
            const name = requiredText(req.body?.name, 'Nom');
            const country = requiredText(req.body?.country, 'Pays');
            const title = requiredText(req.body?.title, 'Métier');
            const keywords = optionalText(req.body?.keywords);
            const lang = allowedLanguages.has(req.body?.lang) ? req.body.lang : 'fr';
            const cron_expression = normalizeCronExpression(req.body?.cron_expression || req.body?.schedule_mode || 'hourly');
            const city = optionalText(req.body?.city);
            const experience_level = optionalText(req.body?.experience_level);
            const contract_type = optionalText(req.body?.contract_type);
            const remote = optionalText(req.body?.remote);
            const job_type = optionalText(req.body?.job_type);
            const salary = optionalText(req.body?.salary);
            const min_salary = optionalText(req.body?.min_salary);
            const max_salary = optionalText(req.body?.max_salary);
            const providers_list = JSON.stringify(parseProviderSelection(req.body?.providers ?? req.body?.selectedProviderIds));

            const [id] = await withDb((db) => db('scheduled_searches').insert({
                name, country, title, keywords, lang, cron_expression,
                city, experience_level, contract_type, remote, job_type, salary, min_salary, max_salary, providers_list,
                enabled: true
            }));
            const schedule = await withDb((db) => db('scheduled_searches').where({ id }).first());
            res.status(201).json(schedule);
        } catch (error) {
            res.status(400).json({ error: error.message || 'Paramètres invalides.' });
        }
    });

    app.put('/api/schedules/:id/toggle', async (req, res) => {
        try {
            const { enabled } = req.body;
            const changed = await withDb((db) => db('scheduled_searches').where({ id: req.params.id }).update({ enabled: enabled ? 1 : 0 }));
            if (!changed) return res.status(404).json({ error: 'Recherche planifiée introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de modifier cette recherche planifiée.' });
        }
    });

    app.delete('/api/schedules/:id', async (req, res) => {
        try {
            const changed = await withDb((db) => db('scheduled_searches').where({ id: req.params.id }).del());
            if (!changed) return res.status(404).json({ error: 'Recherche planifiée introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de supprimer cette recherche planifiée.' });
        }
    });

    // Endpoints Search Configs (configurations de recherche sauvegardées)
    app.get('/api/search-configs', async (req, res) => {
        try {
            const configs = await withDb((db) => db('search_configs').select('*').orderBy('created_at', 'desc'));
            res.json(configs);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les configurations de recherche.' });
        }
    });

    app.post('/api/search-configs', async (req, res) => {
        try {
            const name = requiredText(req.body?.name, 'Nom');
            const country = requiredText(req.body?.country, 'Pays');
            const title = requiredText(req.body?.title, 'Métier');
            const config = {
                name,
                country,
                city: optionalText(req.body?.city),
                title,
                keywords: optionalText(req.body?.keywords),
                experience_level: optionalText(req.body?.experience_level),
                contract_type: optionalText(req.body?.contract_type),
                remote: optionalText(req.body?.remote),
                job_type: optionalText(req.body?.job_type),
                salary: optionalText(req.body?.salary),
                min_salary: optionalText(req.body?.min_salary),
                max_salary: optionalText(req.body?.max_salary),
                lang: allowedLanguages.has(req.body?.lang) ? req.body.lang : 'fr',
                providers_list: JSON.stringify(parseProviderSelection(req.body?.providers ?? req.body?.selectedProviderIds)),
                enabled: true
            };
            const [id] = await withDb((db) => db('search_configs').insert(config));
            const created = await withDb((db) => db('search_configs').where({ id }).first());
            res.status(201).json(created);
        } catch (error) {
            res.status(400).json({ error: error.message || 'Paramètres invalides.' });
        }
    });

    app.put('/api/search-configs/:id', async (req, res) => {
        try {
            const updates = {
                name: optionalText(req.body?.name),
                country: optionalText(req.body?.country),
                city: optionalText(req.body?.city),
                title: optionalText(req.body?.title),
                keywords: optionalText(req.body?.keywords),
                experience_level: optionalText(req.body?.experience_level),
                contract_type: optionalText(req.body?.contract_type),
                remote: optionalText(req.body?.remote),
                job_type: optionalText(req.body?.job_type),
                salary: optionalText(req.body?.salary),
                min_salary: optionalText(req.body?.min_salary),
                max_salary: optionalText(req.body?.max_salary),
                updated_at: new Date().toISOString()
            };
            const providers = parseProviderSelection(req.body?.providers ?? req.body?.selectedProviderIds);
            if (providers.length > 0) {
                updates.providers_list = JSON.stringify(providers);
            }
            const changed = await withDb((db) => db('search_configs').where({ id: req.params.id }).update(updates));
            if (!changed) return res.status(404).json({ error: 'Configuration introuvable.' });
            const updated = await withDb((db) => db('search_configs').where({ id: req.params.id }).first());
            res.json(updated);
        } catch {
            res.status(500).json({ error: 'Impossible de modifier la configuration.' });
        }
    });

    app.delete('/api/search-configs/:id', async (req, res) => {
        try {
            const changed = await withDb((db) => db('search_configs').where({ id: req.params.id }).del());
            if (!changed) return res.status(404).json({ error: 'Configuration introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de supprimer la configuration.' });
        }
    });

    app.post('/api/search-configs/:id/run', async (req, res) => {
        try {
            const config = await withDb((db) => db('search_configs').where({ id: req.params.id }).first());
            if (!config) return res.status(404).json({ error: 'Configuration introuvable.' });

            const advancedFilters = {
                city: config.city || '',
                experienceLevel: config.experience_level || '',
                contractType: config.contract_type || '',
                remote: config.remote || '',
                jobType: config.job_type || '',
                salary: config.salary || '',
                minSalary: config.min_salary || '',
                maxSalary: config.max_salary || '',
                selectedProviderIds: parseProviderSelection(config.providers_list)
            };

            const run = await withDb(async (db) => {
                const [id] = await db('search_runs').insert({
                    country: config.country,
                    title: config.title,
                    keywords: config.keywords || '',
                    lang: config.lang || 'fr',
                    status: 'queued'
                });
                return { id };
            });
            broadcast('search_run_updated', { id: run.id, status: 'queued', title: config.title, country: config.country });

            await launchSearchRun({
                runId: run.id,
                country: config.country,
                title: config.title,
                keywords: config.keywords || '',
                lang: config.lang || 'fr',
                advancedFilters,
                selectedProviderIds: parseProviderSelection(config.providers_list),
                onStatusChange: (updates) => {
                    if (updates.status) {
                        broadcast('search_run_updated', { id: run.id, status: updates.status, error: updates.error || null });
                    }
                    if (updates.status === 'completed' || updates.status === 'failed') {
                        broadcast('jobs_refreshed', {});
                    }
                }
            });

            res.status(202).json({ success: true, runId: run.id, message: `Recherche "${config.name}" lancée.` });
        } catch (error) {
            res.status(500).json({ error: error.message || 'Impossible de lancer la recherche.' });
        }
    });

    app.post('/api/admin/backup', async (req, res) => {
        try {
            const result = await backupDatabase();
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message || 'Impossible d’exécuter la sauvegarde.' });
        }
    });

    // Endpoints Providers
    app.get('/api/providers', async (req, res) => {
        try {
            res.json(defaultRegistry.getMetadataList());
        } catch (err) {
            res.status(500).json({ error: 'Impossible de charger la liste des providers.' });
        }
    });

    app.post('/api/providers/:id/toggle', async (req, res) => {
        try {
            const { enabled } = req.body;
            const success = defaultRegistry.setEnabled(req.params.id, Boolean(enabled));
            if (!success) return res.status(404).json({ error: 'Provider introuvable.' });
            res.json({ success: true, providers: defaultRegistry.getMetadataList() });
        } catch {
            res.status(500).json({ error: 'Impossible d’activer/désactiver le provider.' });
        }
    });

    // Endpoints Jobs
    app.get('/api/jobs', async (req, res) => {
        try {
            const { country, city, contract_type, experience_level, remote, status, salary, min_salary, max_salary } = req.query;
            let query = withDb((db) => {
                let q = db('jobs').select('*');
                if (country) q = q.where('country', country);
                if (city) q = q.where('city', 'like', `%${city}%`);
                if (contract_type) q = q.where('contract_type', contract_type);
                if (experience_level) q = q.where('experience_level', experience_level);
                if (remote) q = q.where('remote', remote);
                if (status) q = q.where('status', status);
                if (salary) q = q.where('salary', 'like', `%${salary}%`);
                if (min_salary) q = q.where('salary', 'like', `%${min_salary}%`);
                if (max_salary) q = q.where('salary', 'like', `%${max_salary}%`);
                return q.orderBy('score', 'desc').orderBy('created_at', 'desc');
            });
            const jobs = await query;
            res.json(jobs);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les offres.' });
        }
    });

    app.delete('/api/jobs/:id', async (req, res) => {
        try {
            const changes = await withDb((db) => db('jobs').where({ id: req.params.id }).del());
            if (!changes) return res.status(404).json({ error: 'Offre introuvable.' });
            broadcast('job_deleted', { id: req.params.id });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de supprimer cette offre.' });
        }
    });

    app.get('/api/jobs/:id/pdf', async (req, res) => {
        try {
            const job = await withDb((db) => db('jobs').where({ id: req.params.id }).select('pdf_path').first());
            if (!job?.pdf_path) return res.status(404).json({ error: 'PDF introuvable.' });
            const pdfPath = path.resolve(job.pdf_path);
            if (!pdfPath.startsWith(`${generatedLettersDirectory}${path.sep}`)) {
                return res.status(403).json({ error: 'Chemin de document invalide.' });
            }
            res.sendFile(pdfPath, (error) => {
                if (error && !res.headersSent) res.status(404).json({ error: 'PDF introuvable.' });
            });
        } catch {
            res.status(500).json({ error: 'Impossible de récupérer le PDF.' });
        }
    });

    app.post('/api/jobs/:id/confirm', async (req, res) => {
        try {
            const result = await confirmUserSubmission(req.params.id);
            broadcast('job_updated', { id: req.params.id, status: 'Soumis' });
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message || 'Impossible de confirmer la soumission.' });
        }
    });

    app.get('/api/jobs/:id/pack', async (req, res) => {
        try {
            const job = await withDb((db) => db('jobs').where({ id: req.params.id }).first());
            if (!job) return res.status(404).json({ error: 'Offre introuvable.' });
            
            let pack = {};
            if (job.prefilled_data) {
                try {
                    pack = JSON.parse(job.prefilled_data);
                } catch (e) {
                    pack = { note: job.prefilled_data };
                }
            }
            res.json({
                jobId: job.id,
                title: job.title,
                company: job.company,
                link: job.link,
                letter: job.letter,
                pdfPath: job.pdf_path,
                pack
            });
        } catch {
            res.status(500).json({ error: 'Impossible de récupérer le dossier de candidature.' });
        }
    });

    app.post('/api/jobs/:id/apply', async (req, res) => {
        try {
            await submitJob(req.params.id);
            const job = await withDb((db) => db('jobs').where({ id: req.params.id }).first());
            broadcast('job_updated', { id: req.params.id, status: job?.status, error: job?.error });
            res.json({ success: true, status: job.status, error: job.error });
        } catch (error) {
            res.status(500).json({ error: `Erreur lors de la tentative de soumission : ${error.message}` });
        }
    });

    app.get('/api/cvs', async (req, res) => {
        try {
            const cvs = await withDb((db) => db('cvs').select('id', 'name', 'path', 'is_active', 'created_at').orderBy('is_active', 'desc').orderBy('created_at', 'desc'));
            res.json(cvs);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les CV.' });
        }
    });

    app.put('/api/cvs/:id/active', async (req, res) => {
        try {
            const found = await withDb(async (db) => {
                const cv = await db('cvs').where({ id: req.params.id }).select('id').first();
                if (!cv) return false;
                await db.transaction(async (trx) => {
                    await trx('cvs').update({ is_active: 0 });
                    await trx('cvs').where({ id: req.params.id }).update({ is_active: 1 });
                });
                return true;
            });
            if (!found) return res.status(404).json({ error: 'CV introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible d’activer ce CV.' });
        }
    });

    app.get('/api/profile', async (req, res) => {
        try {
            const profile = await withDb((db) => db('profile').where({ id: 1 }).first());
            res.json(profile || {});
        } catch {
            res.status(500).json({ error: 'Impossible de charger le profil.' });
        }
    });

    app.put('/api/profile', async (req, res) => {
        try {
            const profile = req.body || {};
            await withDb((db) => db('profile')
                .insert({
                    id: 1,
                    first_name: optionalText(profile.first_name),
                    last_name: optionalText(profile.last_name),
                    dob: optionalText(profile.dob),
                    nationality: optionalText(profile.nationality),
                    address: optionalText(profile.address),
                    phone: optionalText(profile.phone),
                    email: optionalText(profile.email),
                    photo_path: optionalText(profile.photo_path),
                    languages: JSON.stringify(Array.isArray(profile.languages) ? profile.languages : []),
                    skills: JSON.stringify(Array.isArray(profile.skills) ? profile.skills : []),
                    experience: optionalText(profile.experience),
                    education: optionalText(profile.education),
                    availability: optionalText(profile.availability)
                })
                .onConflict('id')
                .merge()
            );
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible d’enregistrer le profil.' });
        }
    });

    app.get('/api/search-runs', async (req, res) => {
        try {
            const runs = await withDb((db) => db('search_runs').select('*').orderBy('created_at', 'desc').orderBy('id', 'desc').limit(20));
            res.json(runs);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les recherches.' });
        }
    });

    app.post('/api/search', async (req, res) => {
        try {
            const country = requiredText(req.body?.country, 'Le pays');
            const title = requiredText(req.body?.title, 'Le métier');
            const keywords = optionalText(req.body?.keywords);
            const lang = allowedLanguages.has(req.body?.lang) ? req.body.lang : 'fr';
            const city = optionalText(req.body?.city);
            const experienceLevel = optionalText(req.body?.experienceLevel);
            const contractType = optionalText(req.body?.contractType);
            const remote = optionalText(req.body?.remote);
            const jobType = optionalText(req.body?.jobType);
            const salary = optionalText(req.body?.salary);
            const minSalary = optionalText(req.body?.minSalary);
            const maxSalary = optionalText(req.body?.maxSalary);
            const selectedProviderIds = parseProviderSelection(req.body?.selectedProviderIds);

            const run = await withDb(async (db) => {
                const [id] = await db('search_runs').insert({ country, title, keywords, lang, status: 'queued' });
                return { id };
            });
            broadcast('search_run_updated', { id: run.id, status: 'queued', title, country });

            await launchSearchRun({
                runId: run.id,
                country,
                title,
                keywords,
                lang,
                advancedFilters: { city, experienceLevel, contractType, remote, jobType, salary, minSalary, maxSalary },
                selectedProviderIds,
                onStatusChange: (updates) => {
                    if (updates.status) {
                        broadcast('search_run_updated', { id: run.id, status: updates.status, error: updates.error || null });
                    }
                    if (updates.status === 'completed' || updates.status === 'failed') {
                        broadcast('jobs_refreshed', {});
                    }
                }
            });
            res.status(202).json({ success: true, runId: run.id, message: 'Recherche multi-providers lancée.' });
        } catch (error) {
            res.status(400).json({ error: error.message || 'Paramètres de recherche invalides.' });
        }
    });

    return app;
}

const app = createApp();

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
    initDb().then(() => {
        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 JobHunter-AI disponible sur http://localhost:${port}`);
            startScheduler();
        });
    }).catch((error) => {
        console.error(`Impossible d’initialiser JobHunter-AI : ${error.message}`);
        process.exitCode = 1;
    });
}

export { createApp };
