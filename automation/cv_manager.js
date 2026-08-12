import { initDb, insertAndGetId } from './db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function addCv(userId, name, filePath, options = {}) {
    const db = await initDb();
    const destPath = path.resolve(__dirname, '../cv/storage', `${userId}_${path.basename(filePath)}`);
    await fs.copyFile(filePath, destPath);

    const existingPrimary = await db('cvs').where({ user_id: userId, is_primary: 1 }).first();
    await db('cvs').insert({
        user_id: userId,
        name,
        path: destPath,
        lang: options.lang || 'fr',
        is_active: existingPrimary ? 0 : 1,
        is_primary: 0
    });
    console.log(`✅ CV ${name} importé pour l'utilisateur ${userId}.`);
}

export async function setActiveCv(userId, cvId) {
    const db = await initDb();
    await db.transaction(async (trx) => {
        // Ne désactiver que les CVs non-primary
        await trx('cvs').where({ user_id: userId }).where('is_primary', 0).update({ is_active: 0 });
        await trx('cvs').where({ user_id: userId, id: cvId }).update({ is_active: 1 });
    });
    console.log(`✅ CV ${cvId} défini comme actif pour l'utilisateur ${userId}.`);
}

export async function getActiveCvPath(userId) {
    const db = await initDb();
    const cv = await db('cvs').where({ user_id: userId, is_active: 1 }).first();
    return cv ? cv.path : null;
}

/**
 * Get the primary (master) CV path for a user.
 * This is the source-of-truth CV that should never be modified.
 * Returns null if the user has no primary CV.
 */
export async function getPrimaryCvPath(userId) {
    const db = await initDb();
    const cv = await db('cvs').where({ user_id: userId, is_primary: 1 }).first();
    if (cv) {
        console.log(`[CV Manager] getPrimaryCvPath(${userId}) → trouvé: id=${cv.id}, path=${cv.path}`);
    } else {
        console.log(`[CV Manager] getPrimaryCvPath(${userId}) → aucun CV principal`);
    }
    return cv ? cv.path : null;
}

/**
 * Create an optimized copy of the primary CV for a specific application.
 * The copy is linked to the job and can be translated/adapted.
 * NEVER modifies the original primary CV.
 */
export async function createOptimizedCvCopy(userId, jobId, targetLang = 'fr') {
    const db = await initDb();
    const primaryCv = await db('cvs').where({ user_id: userId, is_primary: 1 }).first();
    if (!primaryCv) {
        console.log(`[CV Manager] createOptimizedCvCopy(${userId}, job=${jobId}) → ERREUR: aucun CV principal`);
        throw new Error('Aucun CV principal trouvé pour créer une copie optimisée.');
    }

    console.log(`[CV Manager] createOptimizedCvCopy(${userId}, job=${jobId}) → source: primary CV id=${primaryCv.id}, path=${primaryCv.path}`);

    const cvDir = path.join(__dirname, '..', 'cv', 'storage');
    await fs.mkdir(cvDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `${userId}_${jobId}_${timestamp}_optimized_${targetLang}.md`;
    const destPath = path.join(cvDir, fileName);

    // Copy the primary CV content (read-only from primary, write to new file)
    await fs.copyFile(primaryCv.path, destPath);
    console.log(`[CV Manager] createOptimizedCvCopy → copie créée: ${destPath}`);

    // Insert the optimized copy into DB
    const id = await insertAndGetId('cvs', {
        user_id: userId,
        name: `CV Optimisé - Offre #${jobId}`,
        path: destPath,
        lang: targetLang,
        is_active: 0,
        is_primary: 0
    });

    console.log(`[CV Manager] createOptimizedCvCopy → enregistré en BDD: id=${id}, is_primary=0 (jamais le CV original)`);

    // Verify the primary CV is still intact
    const primaryCheck = await db('cvs').where({ user_id: userId, is_primary: 1 }).first();
    if (!primaryCheck) {
        console.error(`[CV Manager] createOptimizedCvCopy → ALERTE: CV principal introuvable après copie!`);
    } else {
        console.log(`[CV Manager] createOptimizedCvCopy → vérification: CV principal toujours intact (id=${primaryCheck.id})`);
    }

    return { id, path: destPath };
}

export async function getAllCvs(userId) {
    const db = await initDb();
    return await db('cvs').where({ user_id: userId }).select('id', 'name', 'path', 'lang', 'is_active', 'is_primary');
}

export async function getCvById(userId, cvId) {
    const db = await initDb();
    return await db('cvs').where({ user_id: userId, id: cvId }).first();
}
