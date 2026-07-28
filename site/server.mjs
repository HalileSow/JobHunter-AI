import express from 'express';
import cors from 'cors';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from '../automation/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const automationDirectory = path.join(__dirname, '..', 'automation');
const automationScript = path.join(automationDirectory, 'main.js');
const generatedLettersDirectory = path.join(__dirname, '..', 'cover_letters', 'generated');
const port = Number(process.env.PORT || 4173);
const allowedLanguages = new Set(['fr', 'en', 'de']);

function requiredText(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${label} est obligatoire.`);
    }
    return value.trim();
}

function optionalText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function withDb(operation) {
    const db = await initDb();
    return await operation(db);
}

function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '100kb' }));
    app.use(express.static(__dirname));

    app.get('/api/health', async (req, res) => {
        try {
            await withDb(async () => undefined);
            res.json({ status: 'ok' });
        } catch {
            res.status(503).json({ error: 'Base de données indisponible.' });
        }
    });

    app.get('/api/jobs', async (req, res) => {
        try {
            const jobs = await withDb((db) => db('jobs').select('*').orderBy('created_at', 'desc').orderBy('id', 'desc'));
            res.json(jobs);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les offres.' });
        }
    });

    app.delete('/api/jobs/:id', async (req, res) => {
        try {
            const changes = await withDb((db) => db('jobs').where({ id: req.params.id }).del());
            if (!changes) return res.status(404).json({ error: 'Offre introuvable.' });
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
            const run = await withDb(async (db) => {
                const [id] = await db('search_runs').insert({ country, title, keywords, lang, status: 'queued' });
                return { id };
            });

            const child = spawn(process.execPath, [automationScript, country, title, keywords, lang], {
                cwd: automationDirectory,
                stdio: 'ignore',
                detached: false
            });
            child.unref();
            child.once('spawn', () => {
                withDb((db) => db('search_runs').where({ id: run.id }).update({ status: 'running', started_at: db.fn.now() })).catch(console.error);
            });
            child.once('error', (error) => {
                withDb((db) => db('search_runs').where({ id: run.id }).update({ status: 'failed', error: error.message, finished_at: db.fn.now() })).catch(console.error);
            });
            child.once('close', (code) => {
                const status = code === 0 ? 'completed' : 'failed';
                const error = code === 0 ? null : `Le workflow s’est arrêté avec le code ${code}.`;
                withDb((db) => db('search_runs').where({ id: run.id }).update({ status, error, finished_at: db.fn.now() })).catch(console.error);
            });
            res.status(202).json({ success: true, runId: run.id, message: 'Recherche lancée.' });
        } catch (error) {
            res.status(400).json({ error: error.message || 'Paramètres de recherche invalides.' });
        }
    });

    return app;
}

const app = createApp();

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
    initDb().then(() => {
        app.listen(port, '0.0.0.0', () => console.log(`🚀 JobHunter-AI disponible sur http://localhost:${port}`));
    }).catch((error) => {
        console.error(`Impossible d’initialiser JobHunter-AI : ${error.message}`);
        process.exitCode = 1;
    });
}

export { createApp };
