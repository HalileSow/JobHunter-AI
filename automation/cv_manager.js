import { initDb } from './db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function addCv(name, filePath) {
    const db = await initDb();
    const destPath = path.resolve(__dirname, '../cv/storage', path.basename(filePath));
    await fs.copyFile(filePath, destPath);
    
    await db('cvs').insert({ name, path: destPath });
    console.log(`✅ CV ${name} importé.`);
}

export async function setActiveCv(cvId) {
    const db = await initDb();
    await db('cvs').update({ is_active: 0 });
    await db('cvs').where({ id: cvId }).update({ is_active: 1 });
    console.log(`✅ CV ${cvId} défini comme actif.`);
}

export async function getActiveCvPath() {
    const db = await initDb();
    const cv = await db('cvs').where({ is_active: 1 }).first();
    return cv ? cv.path : null;
}

export async function getAllCvs() {
    const db = await initDb();
    return await db('cvs').select('id', 'name', 'path');
}
