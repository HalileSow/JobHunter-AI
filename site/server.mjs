import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 4173;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DB_PATH = join(__dirname, '..', 'database', 'jobhunter.db');

async function getDb() {
    return await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

// --- ROUTES API ---

// 1. Liste des offres
app.get('/api/jobs', async (req, res) => {
    try {
        const db = await getDb();
        const jobs = await db.all('SELECT * FROM jobs ORDER BY created_at DESC');
        await db.close();
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: "Erreur base de données" });
    }
});

// 2. Gestion des CV
app.get('/api/cvs', async (req, res) => {
    try {
        const db = await getDb();
        const cvs = await db.all('SELECT * FROM cvs');
        await db.close();
        res.json(cvs);
    } catch (err) {
        res.status(500).json({ error: "Erreur base de données" });
    }
});

// 3. Lancer une recherche (Trigger l'automatisation)
app.post('/api/search', async (req, res) => {
    const { country, title, keywords, lang } = req.body;
    
    try {
        // On lance le script main.js en arrière-plan
        const { exec } = await import('child_process');
        const cmd = `node ${join(__dirname, '..', 'automation', 'main.js')} "${country}" "${title}" "${keywords}" "${lang}"`;
        
        exec(cmd, (error, stdout, stderr) => {
            if (error) console.error(`Exec Error: ${error}`);
            if (stderr) console.error(`Exec Stderr: ${stderr}`);
            console.log(`Exec Stdout: ${stdout}`);
        });

        res.json({ success: true, message: "Recherche lancée en arrière-plan." });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors du lancement de la recherche" });
    }
});

// 4. Suppression d'une offre
app.delete('/api/jobs/:id', async (req, res) => {
    try {
        const db = await getDb();
        await db.run('DELETE FROM jobs WHERE id = ?', [req.params.id]);
        await db.close();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erreur suppression" });
    }
});

app.listen(port, () => {
    console.log(`🚀 JobHunter-AI Dashboard running at http://localhost:${port}`);
});
