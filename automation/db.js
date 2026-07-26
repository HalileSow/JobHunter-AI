import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH = path.resolve(__dirname, '../database/jobhunter.db');

function databasePath() {
    return process.env.JOBHUNTER_DB_PATH || DEFAULT_DB_PATH;
}

async function addColumnIfMissing(db, table, definition) {
    const column = definition.split(/\s+/)[0];
    const columns = await db.all(`PRAGMA table_info(${table})`);
    if (!columns.some(({ name }) => name === column)) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    }
}

async function seedDefaultCv(db) {
    const existingCv = await db.get('SELECT id FROM cvs LIMIT 1');
    if (existingCv) return;

    const defaultCvPath = path.resolve(__dirname, '../cv/cv_fr.md');
    try {
        await fs.access(defaultCvPath);
        await db.run('INSERT INTO cvs (name, path, is_active) VALUES (?, ?, 1)', ['CV français', defaultCvPath]);
    } catch {
        // Le CV peut être ajouté plus tard depuis l’interface ; l’initialisation de la base reste possible.
    }
}

async function initDb() {
    const db = await open({
        filename: databasePath(),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            company TEXT,
            link TEXT,
            country TEXT,
            score INTEGER,
            letter TEXT,
            analysis TEXT,
            status TEXT DEFAULT 'Enregistré',
            salary TEXT,
            contract_type TEXT,
            date_posted TEXT,
            selected_cv_id INTEGER,
            pdf_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS cvs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            path TEXT,
            is_active INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            first_name TEXT,
            last_name TEXT,
            dob TEXT,
            nationality TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            photo_path TEXT,
            languages TEXT,
            skills TEXT,
            experience TEXT,
            education TEXT,
            availability TEXT
        );
        CREATE TABLE IF NOT EXISTS search_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country TEXT NOT NULL,
            title TEXT NOT NULL,
            keywords TEXT DEFAULT '',
            lang TEXT NOT NULL DEFAULT 'fr',
            status TEXT NOT NULL DEFAULT 'queued',
            error TEXT,
            started_at DATETIME,
            finished_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(score DESC);
        CREATE INDEX IF NOT EXISTS idx_search_runs_created_at ON search_runs(created_at DESC);
    `);

    // Migrations pour les bases créées par les versions antérieures.
    await addColumnIfMissing(db, 'jobs', 'salary TEXT');
    await addColumnIfMissing(db, 'jobs', 'contract_type TEXT');
    await addColumnIfMissing(db, 'jobs', 'date_posted TEXT');
    await addColumnIfMissing(db, 'jobs', 'selected_cv_id INTEGER');
    await addColumnIfMissing(db, 'jobs', 'pdf_path TEXT');
    await seedDefaultCv(db);
    return db;
}

export { initDb };
