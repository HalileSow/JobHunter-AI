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
import { startScheduler, stopScheduler, restartBackupScheduler } from '../automation/scheduler.js';
import { closeBrowser } from '../automation/browser_pool.js';
import { launchSearchRun } from '../automation/search_run_launcher.js';
import { importDefaultCvs } from '../automation/import_default_cvs.js';
import { testWebhook, detectPlatform } from '../automation/notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    console.warn('⚠️  JWT_SECRET non configuré — utilisation d\'un secret par défaut. Définissez JWT_SECRET dans .env pour la production.');
    return 'dev-secret-key';
})();
const BOOTSTRAP_SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL || 'superadmin@jobhunter.local').trim().toLowerCase();
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

function normalizeEmail(value) {
    return requiredText(value, 'Email').toLowerCase();
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
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Token invalide.' });
        req.user = decoded;
        next();
    });
}

function authorize(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès interdit.' });
        }
        next();
    };
}

function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '2mb' }));
    app.use(express.static(__dirname));

    let sseClients = [];
    const MAX_SSE_CLIENTS = 10; // OPTIMISATION MÉMOIRE : Limite max de clients SSE
    const SSE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes timeout

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
        // OPTIMISATION MÉMOIRE : Limiter le nombre de clients SSE
        if (sseClients.length >= MAX_SSE_CLIENTS) {
            console.warn(`⚠️ [SSE] Limite de ${MAX_SSE_CLIENTS} clients atteinte, refus de nouvelle connexion`);
            return res.status(503).json({ error: 'Trop de connexions actives.' });
        }

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
        const newClient = { id: clientId, res, authenticated, createdAt: Date.now() };
        sseClients.push(newClient);

        // OPTIMISATION MÉMOIRE : Timeout automatique pour éviter les connexions orphelines
        const timeout = setTimeout(() => {
            console.log(`🔌 [SSE] Timeout client ${clientId}, fermeture`);
            try {
                res.end();
            } catch {}
            sseClients = sseClients.filter((c) => c.id !== clientId);
        }, SSE_TIMEOUT_MS);

        res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientId, authenticated })}\n\n`);

        req.on('close', () => {
            clearTimeout(timeout);
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
            const email = normalizeEmail(req.body?.email);
            const password = requiredText(req.body?.password, 'Mot de passe');
            const hashedPassword = await bcrypt.hash(password, 10);
            const role = await withDb(async (db) => {
                const hasSuperAdmin = await db('users').where({ role: 'SUPER_ADMIN' }).first();
                return !hasSuperAdmin && email === BOOTSTRAP_SUPER_ADMIN_EMAIL ? 'SUPER_ADMIN' : 'USER';
            });
            const [userId] = await withDb((db) => db('users').insert({ email, password: hashedPassword, role }));
            try {
                await importDefaultCvs(userId);
            } catch (cvErr) {
                console.warn('⚠️ Import CVs par défaut échoué:', cvErr.message);
            }
            res.status(201).json({ success: true, role });
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
            const email = normalizeEmail(req.body?.email);
            const password = requiredText(req.body?.password, 'Mot de passe');
            const user = await withDb((db) => db('users').where({ email }).first());
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ error: 'Identifiants invalides.' });
            }
            if (user.role !== 'SUPER_ADMIN' && email === BOOTSTRAP_SUPER_ADMIN_EMAIL) {
                const bootstrapAdminMissing = await withDb(async (db) => {
                    const existingSuperAdmin = await db('users').where({ role: 'SUPER_ADMIN' }).first();
                    if (existingSuperAdmin) return false;
                    await db('users').where({ id: user.id }).update({ role: 'SUPER_ADMIN' });
                    return true;
                });
                if (bootstrapAdminMissing) {
                    user.role = 'SUPER_ADMIN';
                }
            }
            if (user.status !== 'ACTIVE') {
                return res.status(403).json({ error: 'Compte suspendu.' });
            }

            // Auto-import master CV for SUPER_ADMIN users who don't have one
            if (user.role === 'SUPER_ADMIN') {
                try {
                    const hasPrimaryCv = await withDb((db) => db('cvs').where({ user_id: user.id, is_primary: 1 }).first());
                    if (!hasPrimaryCv) {
                        await importDefaultCvs(user.id);
                    }
                } catch (cvErr) {
                    console.warn('⚠️ Auto-import master CV at login échoué:', cvErr.message);
                }
            }

            const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token });
        } catch {
            res.status(500).json({ error: 'Erreur lors de la connexion.' });
        }
    });

    // Routes publiques (sans authentification)
    // /api/events, /api/health, /api/system/status, /api/auth/* sont publics
    
    // Routes protégées (authentification requise)
    app.use(['/api/jobs', '/api/cvs', '/api/profile', '/api/search', '/api/search-runs', '/api/providers', '/api/admin', '/api/schedules', '/api/search-configs', '/api/webhooks'], auth);

    // Endpoints Recherches Planifiées
    app.get('/api/schedules', async (req, res) => {
        try {
            const schedules = await withDb((db) => db('scheduled_searches').select('*').where({ user_id: req.user.id }).orderBy('created_at', 'desc'));
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

            const { computeNextRun } = await import('../automation/scheduler.js');
            const nextRun = computeNextRun(cron_expression);

            const [id] = await withDb((db) => db('scheduled_searches').insert({
                user_id: req.user.id,
                name, country, title, keywords, lang, cron_expression,
                city, experience_level, contract_type, remote, job_type, salary, min_salary, max_salary, providers_list,
                enabled: true,
                next_run_at: nextRun ? nextRun.toISOString() : null
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
            const updateData = { enabled: enabled ? 1 : 0 };
            if (enabled) {
                const schedule = await withDb((db) => db('scheduled_searches').where({ id: req.params.id, user_id: req.user.id }).first());
                if (!schedule) return res.status(404).json({ error: 'Recherche planifiée introuvable.' });
                const { computeNextRun } = await import('../automation/scheduler.js');
                const nextRun = computeNextRun(schedule.cron_expression);
                updateData.next_run_at = nextRun ? nextRun.toISOString() : null;
            }
            const changed = await withDb((db) => db('scheduled_searches').where({ id: req.params.id, user_id: req.user.id }).update(updateData));
            if (!changed) return res.status(404).json({ error: 'Recherche planifiée introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de modifier cette recherche planifiée.' });
        }
    });

    app.post('/api/schedules/:id/run', async (req, res) => {
        try {
            const schedule = await withDb((db) => db('scheduled_searches').where({ id: req.params.id, user_id: req.user.id }).first());
            if (!schedule) return res.status(404).json({ error: 'Recherche planifiée introuvable.' });

            // Mark as running immediately
            await withDb((db) => db('scheduled_searches').where({ id: schedule.id }).update({ last_status: 'running', last_error: null }));

            res.json({ success: true, message: 'Exécution déclenchée.' });

            // Force immediate execution in background — bypass cron/next_run_at check
            (async () => {
                const { runFullJobHunterSearch } = await import('../automation/search_engine.js');
                const { processJobSubmission } = await import('../automation/submission_engine.js');
                const { notifyUserJob } = await import('../automation/notifications.js');
                const { computeNextRun } = await import('../automation/scheduler.js');
                const db = await initDb();

                const userId = schedule.user_id || (await db('users').where({ role: 'SUPER_ADMIN' }).first())?.id;
                if (!userId) {
                    console.error(`❌ [API] Aucun user_id pour schedule #${schedule.id}`);
                    await db('scheduled_searches').where({ id: schedule.id }).update({ last_status: 'error', last_error: 'Aucun user_id' });
                    return;
                }

                console.log(`🚀 [API] Exécution manuelle schedule #${schedule.id} "${schedule.name}" pour user_id=${userId}`);

                const [inserted] = await db('search_runs').insert({
                    country: schedule.country, title: schedule.title,
                    keywords: schedule.keywords || '', lang: schedule.lang || 'fr',
                    status: 'running', user_id: userId
                }).returning('id');
                const runId = inserted?.id || inserted;

                try {
                    const result = await runFullJobHunterSearch({
                        country: schedule.country, jobTitle: schedule.title,
                        keywords: schedule.keywords || '', lang: schedule.lang || 'fr',
                        selectedProviderIds: JSON.parse(schedule.providers_list || '[]'),
                        userId
                    });

                    for (const job of (result.jobs || [])) {
                        if (job.score >= 85) await processJobSubmission(job.id);
                    }
                    if (result.jobs?.length > 0) {
                        notifyUserJob({ db, userId, jobs: result.jobs }).catch(() => {});
                    }

                    await db('search_runs').where({ id: runId }).update({
                        status: 'completed', finished_at: db.fn.now(),
                        raw_jobs_count: result.rawJobsFound || 0, unique_jobs_count: result.uniqueJobsFound || 0,
                        analyzed_jobs_count: result.jobsAnalyzed || 0, saved_jobs_count: result.jobsSaved || 0,
                        duplicate_jobs_count: result.duplicateJobsSkipped || 0
                    });

                    const nextRun = computeNextRun(schedule.cron_expression);
                    await db('scheduled_searches').where({ id: schedule.id }).update({
                        last_run_at: db.fn.now(), next_run_at: nextRun ? nextRun.toISOString() : null,
                        total_runs: db.raw('total_runs + 1'), last_status: 'success',
                        last_raw_jobs_count: result.rawJobsFound || 0,
                        last_unique_jobs_count: result.uniqueJobsFound || 0,
                        last_analyzed_jobs_count: result.jobsAnalyzed || 0,
                        last_new_jobs_count: result.jobsSaved || 0,
                        last_duplicate_jobs_count: result.duplicateJobsSkipped || 0,
                        last_error: null
                    });

                    console.log(`✅ [API] Exécution manuelle terminée : ${result.rawJobsFound} brutes, ${result.jobsSaved} sauvegardées`);
                } catch (error) {
                    console.error(`❌ [API] Erreur exécution manuelle schedule #${schedule.id}: ${error.message}`);
                    await db('search_runs').where({ id: runId }).update({ status: 'failed', error: error.message, finished_at: db.fn.now() });
                    await db('scheduled_searches').where({ id: schedule.id }).update({ last_status: 'error', last_error: error.message });
                }
            })().catch((err) => console.error(`❌ [API] Erreur critique exécution manuelle: ${err.stack || err.message}`));
        } catch {
            res.status(500).json({ error: 'Impossible de déclencher l\'exécution.' });
        }
    });

    app.delete('/api/schedules/:id', async (req, res) => {
        try {
            const changed = await withDb((db) => db('scheduled_searches').where({ id: req.params.id, user_id: req.user.id }).del());
            if (!changed) return res.status(404).json({ error: 'Recherche planifiée introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de supprimer cette recherche planifiée.' });
        }
    });

    // Endpoints Search Configs (configurations de recherche sauvegardées)
    app.get('/api/search-configs', async (req, res) => {
        try {
            const configs = await withDb((db) => db('search_configs').select('*').where({ user_id: req.user.id }).orderBy('created_at', 'desc'));
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
            const [id] = await withDb((db) => db('search_configs').insert({ ...config, user_id: req.user.id }));
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
            const changed = await withDb((db) => db('search_configs').where({ id: req.params.id, user_id: req.user.id }).update(updates));
            if (!changed) return res.status(404).json({ error: 'Configuration introuvable.' });
            const updated = await withDb((db) => db('search_configs').where({ id: req.params.id, user_id: req.user.id }).first());
            res.json(updated);
        } catch {
            res.status(500).json({ error: 'Impossible de modifier la configuration.' });
        }
    });

    app.delete('/api/search-configs/:id', async (req, res) => {
        try {
            const changed = await withDb((db) => db('search_configs').where({ id: req.params.id, user_id: req.user.id }).del());
            if (!changed) return res.status(404).json({ error: 'Configuration introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de supprimer la configuration.' });
        }
    });

    app.post('/api/search-configs/:id/run', async (req, res) => {
        try {
            const config = await withDb((db) => db('search_configs').where({ id: req.params.id, user_id: req.user.id }).first());
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
                    user_id: req.user.id,
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
                userId: req.user.id,
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

    // Endpoints Webhooks (notifications Telegram/Slack)
    app.get('/api/webhooks', async (req, res) => {
        try {
            const webhooks = await withDb((db) =>
                db('notification_webhooks').select('id', 'platform', 'webhook_url', 'label', 'enabled', 'score_threshold', 'notify_on_new_job', 'notify_on_high_score', 'last_sent_at', 'total_sent', 'last_error', 'created_at')
                    .where({ user_id: req.user.id })
                    .orderBy('created_at', 'desc')
            );
            res.json(webhooks);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les webhooks.' });
        }
    });

    app.post('/api/webhooks', async (req, res) => {
        try {
            const webhook_url = requiredText(req.body?.webhook_url, 'URL du webhook');
            const platform = detectPlatform(webhook_url);
            if (platform === 'generic') {
                return res.status(400).json({ error: 'URL non reconnue comme Telegram ou Slack.' });
            }
            const label = optionalText(req.body?.label);
            const score_threshold = Number(req.body?.score_threshold ?? 70);
            if (score_threshold < 0 || score_threshold > 100) {
                return res.status(400).json({ error: 'score_threshold doit être entre 0 et 100.' });
            }

            const [id] = await withDb((db) => db('notification_webhooks').insert({
                user_id: req.user.id,
                platform,
                webhook_url,
                label,
                score_threshold,
                enabled: true,
                notify_on_new_job: req.body?.notify_on_new_job !== false,
                notify_on_high_score: req.body?.notify_on_high_score !== false
            }));
            const created = await withDb((db) =>
                db('notification_webhooks').select('id', 'platform', 'webhook_url', 'label', 'enabled', 'score_threshold', 'created_at').where({ id }).first()
            );
            res.status(201).json(created);
        } catch (error) {
            res.status(400).json({ error: error.message || 'Paramètres invalides.' });
        }
    });

    app.put('/api/webhooks/:id', async (req, res) => {
        try {
            const updates = {};
            if (req.body?.label !== undefined) updates.label = optionalText(req.body.label);
            if (req.body?.enabled !== undefined) updates.enabled = req.body.enabled ? 1 : 0;
            if (req.body?.score_threshold !== undefined) {
                const t = Number(req.body.score_threshold);
                if (t < 0 || t > 100) return res.status(400).json({ error: 'score_threshold doit être entre 0 et 100.' });
                updates.score_threshold = t;
            }
            if (req.body?.notify_on_new_job !== undefined) updates.notify_on_new_job = req.body.notify_on_new_job ? 1 : 0;
            if (req.body?.notify_on_high_score !== undefined) updates.notify_on_high_score = req.body.notify_on_high_score ? 1 : 0;
            updates.updated_at = new Date().toISOString();

            const changed = await withDb((db) =>
                db('notification_webhooks').where({ id: req.params.id, user_id: req.user.id }).update(updates)
            );
            if (!changed) return res.status(404).json({ error: 'Webhook introuvable.' });
            const updated = await withDb((db) =>
                db('notification_webhooks').select('id', 'platform', 'webhook_url', 'label', 'enabled', 'score_threshold', 'notify_on_new_job', 'notify_on_high_score', 'last_sent_at', 'total_sent', 'last_error', 'created_at')
                    .where({ id: req.params.id, user_id: req.user.id }).first()
            );
            res.json(updated);
        } catch {
            res.status(500).json({ error: 'Impossible de modifier le webhook.' });
        }
    });

    app.delete('/api/webhooks/:id', async (req, res) => {
        try {
            const changed = await withDb((db) =>
                db('notification_webhooks').where({ id: req.params.id, user_id: req.user.id }).del()
            );
            if (!changed) return res.status(404).json({ error: 'Webhook introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de supprimer le webhook.' });
        }
    });

    app.post('/api/webhooks/test', async (req, res) => {
        try {
            const webhook_url = requiredText(req.body?.webhook_url, 'URL du webhook');
            const result = await testWebhook(webhook_url);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/admin/backup', authorize(['SUPER_ADMIN']), async (req, res) => {
        try {
            const result = await backupDatabase();
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message || 'Impossible d\'exécuter la sauvegarde.' });
        }
    });

    // GET /api/admin/backup/status — statut du dernier backup + configuration
    app.get('/api/admin/backup/status', authorize(['SUPER_ADMIN']), async (req, res) => {
        try {
            const settings = await withDb(async (db) => {
                const row = await db('backup_settings').first();
                if (!row) {
                    return {
                        enabled: false,
                        interval_hours: 0,
                        retention_max: 0,
                        last_run_at: null,
                        last_backup_path: null,
                        last_error: null
                    };
                }
                return {
                    enabled: Boolean(row.enabled),
                    interval_hours: row.interval_hours,
                    retention_max: row.retention_max,
                    last_run_at: row.last_run_at,
                    last_backup_path: row.last_backup_path,
                    last_error: row.last_error
                };
            });

            // Lister les backups existants
            const fs = await import('node:fs/promises');
            const path = await import('node:path');
            const backupsDir = path.join(__dirname, '..', 'database', 'backups');
            let backups = [];
            try {
                const files = await fs.readdir(backupsDir);
                const backupFiles = files.filter(f => f.startsWith('backup-jobhunter-') && f.endsWith('.db'));
                const stats = await Promise.all(
                    backupFiles.map(async (f) => {
                        const s = await fs.stat(path.join(backupsDir, f));
                        return { filename: f, size: s.size, created: s.mtime };
                    })
                );
                stats.sort((a, b) => b.created - a.created);
                backups = stats.slice(0, 10); // 10 plus récents
            } catch {
                // directory may not exist if no backups yet
            }

            res.json({ settings, backups });
        } catch (error) {
            res.status(500).json({ error: error.message || 'Impossible de charger le statut des sauvegardes.' });
        }
    });

    // PUT /api/admin/backup/settings — configurer l'intervalle de backup
    app.put('/api/admin/backup/settings', authorize(['SUPER_ADMIN']), async (req, res) => {
        try {
            const { interval_hours, retention_max, enabled } = req.body || {};

            const updates = {};
            if (interval_hours !== undefined) {
                const h = Number(interval_hours);
                if (h < 1 || h > 168) return res.status(400).json({ error: 'interval_hours doit être entre 1 et 168.' });
                updates.interval_hours = h;
            }
            if (retention_max !== undefined) {
                const r = Number(retention_max);
                if (r < 1 || r > 100) return res.status(400).json({ error: 'retention_max doit être entre 1 et 100.' });
                updates.retention_max = r;
            }
            if (enabled !== undefined) {
                updates.enabled = enabled ? 1 : 0;
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'Aucun paramètre à mettre.' });
            }

            updates.updated_at = (await initDb()).fn.now();

            await withDb(async (db) => {
                // Ensure row exists
                const existing = await db('backup_settings').first();
                if (!existing) {
                    await db('backup_settings').insert({
                        interval_hours: updates.interval_hours || 12,
                        retention_max: updates.retention_max || 14,
                        enabled: updates.enabled !== undefined ? updates.enabled : 1
                    });
                } else {
                    await db('backup_settings').update(updates);
                }
            });

            // Redémarrer le scheduler de backup avec les nouveaux paramètres
            const { restartBackupScheduler } = await import('../automation/scheduler.js');
            restartBackupScheduler();

            const updated = await withDb((db) => db('backup_settings').first());
            res.json({
                success: true,
                settings: {
                    enabled: Boolean(updated.enabled),
                    interval_hours: updated.interval_hours,
                    retention_max: updated.retention_max
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message || 'Impossible de modifier les paramètres de sauvegarde.' });
        }
    });


    app.get('/api/admin/users', authorize(['SUPER_ADMIN']), async (req, res) => {
        try {
            const users = await withDb((db) => db('users').select('id', 'email', 'role', 'status', 'created_at'));
            res.json(users);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les utilisateurs.' });
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

    app.post('/api/admin/providers/:id/toggle', authorize(['SUPER_ADMIN']), async (req, res) => {
        try {
            const { enabled } = req.body;
            const success = defaultRegistry.setEnabled(req.params.id, Boolean(enabled));
            if (!success) return res.status(404).json({ error: 'Provider introuvable.' });
            res.json({ success: true, providers: defaultRegistry.getMetadataList() });
        } catch {
            res.status(500).json({ error: 'Impossible d\'activer/désactiver le provider.' });
        }
    });

    // Endpoints Jobs
    app.get('/api/jobs', auth, async (req, res) => {
        try {
            const { country, city, contract_type, experience_level, remote, status, salary, min_salary, max_salary } = req.query;
            let query = withDb((db) => {
                let q = db('jobs').select('*').where({ user_id: req.user.id });
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
            const changes = await withDb((db) => db('jobs').where({ id: req.params.id, user_id: req.user.id }).del());
            if (!changes) return res.status(404).json({ error: 'Offre introuvable.' });
            broadcast('job_deleted', { id: req.params.id });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de supprimer cette offre.' });
        }
    });

    app.get('/api/jobs/:id/pdf', async (req, res) => {
        try {
            const job = await withDb((db) => db('jobs').where({ id: req.params.id, user_id: req.user.id }).select('pdf_path').first());
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
            const job = await withDb((db) => db('jobs').where({ id: req.params.id }).first());
            if (!job) return res.status(404).json({ error: 'Offre introuvable.' });
            if (job.user_id !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Accès interdit.' });
            }
            const result = await confirmUserSubmission(req.params.id);
            broadcast('job_updated', { id: req.params.id, status: 'Soumis' });
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message || 'Impossible de confirmer la soumission.' });
        }
    });

    app.get('/api/jobs/:id/pack', async (req, res) => {
        try {
            const job = await withDb((db) => db('jobs').where({ id: req.params.id, user_id: req.user.id }).first());
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
            const job = await withDb((db) => db('jobs').where({ id: req.params.id }).first());
            if (!job) return res.status(404).json({ error: 'Offre introuvable.' });
            if (job.user_id !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Accès interdit.' });
            }
            await submitJob(req.params.id);
            const updatedJob = await withDb((db) => db('jobs').where({ id: req.params.id, user_id: job.user_id }).first());
            broadcast('job_updated', { id: req.params.id, status: updatedJob?.status, error: updatedJob?.error });
            res.json({ success: true, status: updatedJob.status, error: updatedJob.error });
        } catch (error) {
            res.status(500).json({ error: `Erreur lors de la tentative de soumission : ${error.message}` });
        }
    });

    app.get('/api/cvs', async (req, res) => {
        try {
            let cvs = await withDb((db) => db('cvs').select('id', 'name', 'path', 'lang', 'is_active', 'is_primary', 'created_at').where({ user_id: req.user.id }).orderBy('is_primary', 'desc').orderBy('is_active', 'desc').orderBy('created_at', 'desc'));
            if (cvs.length === 0) {
                try {
                    await importDefaultCvs(req.user.id);
                    cvs = await withDb((db) => db('cvs').select('id', 'name', 'path', 'lang', 'is_active', 'is_primary', 'created_at').where({ user_id: req.user.id }).orderBy('is_primary', 'desc').orderBy('is_active', 'desc').orderBy('created_at', 'desc'));
                } catch (importErr) {
                    console.warn('⚠️ Auto-import CVs échoué:', importErr.message);
                }
            }
            res.json(cvs);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les CV.' });
        }
    });

    app.put('/api/cvs/:id/active', async (req, res) => {
        try {
            const found = await withDb(async (db) => {
                const cv = await db('cvs').where({ id: req.params.id, user_id: req.user.id }).select('id', 'is_primary').first();
                if (!cv) return false;
                // On ne touche jamais au CV principal (is_primary=1)
                if (cv.is_primary) return true; // déjà le CV principal, rien à faire
                await db.transaction(async (trx) => {
                    // Désactiver les CVs non-primary uniquement
                    await trx('cvs').where({ user_id: req.user.id }).where('is_primary', 0).update({ is_active: 0 });
                    await trx('cvs').where({ id: req.params.id, user_id: req.user.id }).update({ is_active: 1 });
                });
                return true;
            });
            if (!found) return res.status(404).json({ error: 'CV introuvable.' });
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: "Impossible d'activer ce CV." });
        }
    });

    app.delete('/api/cvs/:id', async (req, res) => {
        try {
            const cv = await withDb((db) => db('cvs').where({ id: req.params.id, user_id: req.user.id }).select('path', 'is_primary').first());
            if (!cv) return res.status(404).json({ error: 'CV introuvable.' });
            if (cv.is_primary) return res.status(403).json({ error: 'Le CV principal ne peut pas être supprimé.' });
            await withDb((db) => db('cvs').where({ id: req.params.id, user_id: req.user.id }).del());
            // Supprimer le fichier physique si le chemin est dans cv/storage
            if (cv.path) {
                try {
                    const fs = await import('node:fs/promises');
                    const resolvedPath = path.resolve(cv.path);
                    const storageDir = path.join(__dirname, '..', 'cv', 'storage');
                    if (resolvedPath.startsWith(storageDir)) {
                        await fs.unlink(resolvedPath);
                    }
                } catch {
                    // Fichier déjà supprimé ou inaccessible, on continue
                }
            }
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible de supprimer ce CV.' });
        }
    });

    app.post('/api/cvs', async (req, res) => {
        try {
            const { name, content } = req.body || {};
            const cvName = requiredText(name, 'Nom du CV');
            const cvContent = requiredText(content, 'Contenu du CV');

            // Le CV uploadé n'est JAMAIS marqué comme primary.
            // Le CV principal (is_primary=1) est protégé et non remplaçable.
            // Les CVs uploadés sont des copies/version alternatives (is_primary=0).
            const existingPrimaryCv = await withDb((db) => db('cvs').where({ user_id: req.user.id, is_primary: 1 }).first());

            const cvDir = path.join(__dirname, '..', 'cv', 'storage');
            const fs = await import('node:fs/promises');
            await fs.mkdir(cvDir, { recursive: true });

            const isPdf = cvContent.startsWith('[PDF:');
            const ext = isPdf ? '.pdf' : '.md';

            const sanitized = cvName.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, '_').substring(0, 80);
            const fileName = `${req.user.id}_${Date.now()}_${sanitized}${ext}`;
            const destPath = path.join(cvDir, fileName);

            if (isPdf) {
                // Extract base64 content after the [PDF:name] prefix
                const base64Start = cvContent.indexOf(']\n') + 2;
                const base64Data = cvContent.substring(base64Start);
                const buffer = Buffer.from(base64Data, 'base64');
                await fs.writeFile(destPath, buffer);
            } else {
                await fs.writeFile(destPath, cvContent, 'utf-8');
            }

            const [id] = await withDb((db) => db('cvs').insert({
                user_id: req.user.id,
                name: cvName,
                path: destPath,
                is_active: existingPrimaryCv ? 0 : 1, // Si pas de CV primary, celui-ci devient actif par défaut
                is_primary: 0
            }));

            const cv = await withDb((db) => db('cvs').where({ id }).first());
            res.status(201).json(cv);
        } catch (error) {
            if (error.message.includes('est obligatoire')) {
                return res.status(400).json({ error: error.message });
            }
            console.error('Erreur upload CV:', error);
            res.status(500).json({ error: "Impossible d'importer ce CV." });
        }
    });

    app.get('/api/profile', async (req, res) => {
        try {
            const profile = await withDb((db) => db('profile').where({ user_id: req.user.id }).first());
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
                    user_id: req.user.id,
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
                .onConflict('user_id')
                .merge()
            );
            res.json({ success: true });
        } catch {
            res.status(500).json({ error: 'Impossible d’enregistrer le profil.' });
        }
    });

    app.get('/api/search-runs', async (req, res) => {
        try {
            const runs = await withDb((db) => db('search_runs').select('*').where({ user_id: req.user.id }).orderBy('created_at', 'desc').orderBy('id', 'desc').limit(20));
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
                const [id] = await db('search_runs').insert({ country, title, keywords, lang, status: 'queued', user_id: req.user.id });
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
                userId: req.user.id,
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
    initDb().then(async () => {
        // Import default CVs for users who don't have any
        try {
            await importDefaultCvs();
        } catch (err) {
            console.warn('⚠️ Could not import default CVs:', err.message);
        }

        // Seed permanent super-admin account if missing
        try {
            const existingSuperAdmin = await withDb((db) => db('users').where({ email: BOOTSTRAP_SUPER_ADMIN_EMAIL }).first());
            if (!existingSuperAdmin) {
                const hashedPassword = await bcrypt.hash('SuperAdmin2024!', 10);
                const [newUserId] = await withDb((db) => db('users').insert({
                    email: BOOTSTRAP_SUPER_ADMIN_EMAIL,
                    password: hashedPassword,
                    role: 'SUPER_ADMIN',
                    status: 'ACTIVE'
                }));
                console.log(`✅ Bootstrap super-admin créé (ID: ${newUserId}) — email: ${BOOTSTRAP_SUPER_ADMIN_EMAIL}`);
            }
        } catch (err) {
            console.warn('⚠️ Bootstrap super-admin seed échoué:', err.message);
        }

        const server = app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 JobHunter-AI disponible sur http://localhost:${port}`);
            startScheduler();
        });

        // Arrêt gracieux : fermer proprement les connexions et le scheduler
        const gracefulShutdown = async (signal) => {
            console.log(`\n⚠️ Signal ${signal} reçu. Arrêt gracieux en cours...`);

            stopScheduler();

            // OPTIMISATION MÉMOIRE : Fermer le browser pool pour libérer la mémoire Chromium
            await closeBrowser();

            // Fermer le serveur HTTP (arrête d'accepter les nouvelles connexions)
            await new Promise((resolve) => server.close(resolve));

            // Fermer le pool de connexions Knex
            const { db } = await import('../automation/db.js');
            await db.destroy();

            console.log('✅ Arrêt terminé. À bientôt !');
            process.exit(0);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Éviter que le processus ne reste bloqué si les handlers plantent
        process.on('uncaughtException', (err) => {
            console.error('❌ Exception non capturée:', err.message);
            gracefulShutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason) => {
            console.error('❌ Rejet de promesse non capturé:', reason);
        });
    }).catch((error) => {
        console.error(`Impossible d'initialiser JobHunter-AI : ${error.message}`);
        process.exitCode = 1;
    });
}

export { createApp };
