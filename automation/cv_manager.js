import { initDb } from './db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function addCv(name, filePath) {
    const db = await initDb();
    const destPath = path.resolve(__dirname, '../cv/storage', path.basename(filePath));
    await fs.copyFile(filePath, destPath);
    
    await db.run('INSERT INTO cvs (name, path) VALUES (?, ?)', [name, destPath]);
    await db.close();
    console.log(`✅ CV ${name} importé.`);
}

export async function setActiveCv(cvId) {
    const db = await initDb();
    await db.run('UPDATE cvs SET is_active = 0');
    await db.run('UPDATE cvs SET is_active = 1 WHERE id = ?', [cvId]);
    await db.close();
    console.log(`✅ CV ${cvId} défini comme actif.`);
}

export async function getActiveCvPath() {
    const db = await initDb();
    const cv = await db.get('SELECT path FROM cvs WHERE is_active = 1');
    await db.close();
    return cv ? cv.path : null;
}

export async function getAllCvs() {
    const db = await initDb();
    const cvs = await db.all('SELECT id, name, path FROM cvs');
    await db.close();
    return cvs;
}
