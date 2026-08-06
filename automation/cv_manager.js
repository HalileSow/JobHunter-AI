import { initDb } from './db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function addCv(userId, name, filePath) {
    const db = await initDb();
    const destPath = path.resolve(__dirname, '../cv/storage', `${userId}_${path.basename(filePath)}`);
    await fs.copyFile(filePath, destPath);
    
    await db('cvs').insert({ user_id: userId, name, path: destPath });
    console.log(`✅ CV ${name} importé pour l'utilisateur ${userId}.`);
}

export async function setActiveCv(userId, cvId) {
    const db = await initDb();
    await db.transaction(async (trx) => {
        await trx('cvs').where({ user_id: userId }).update({ is_active: 0 });
        await trx('cvs').where({ user_id: userId, id: cvId }).update({ is_active: 1 });
    });
    console.log(`✅ CV ${cvId} défini comme actif pour l'utilisateur ${userId}.`);
}

export async function getActiveCvPath(userId) {
    const db = await initDb();
    const cv = await db('cvs').where({ user_id: userId, is_active: 1 }).first();
    return cv ? cv.path : null;
}

export async function getAllCvs(userId) {
    const db = await initDb();
    return await db('cvs').where({ user_id: userId }).select('id', 'name', 'path', 'is_active');
}

export async function getCvById(userId, cvId) {
    const db = await initDb();
    return await db('cvs').where({ user_id: userId, id: cvId }).first();
}
