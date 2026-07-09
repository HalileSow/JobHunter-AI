import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDb() {
    const db = await open({
        filename: path.resolve(__dirname, '../database/jobhunter.db'),
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
        )
    `);
    return db;
}

export { initDb };
