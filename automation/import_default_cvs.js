import { initDb } from './db.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Check if a user is a SUPER_ADMIN.
 */
async function isSuperAdmin(db, userId) {
    const user = await db('users').where({ id: userId }).select('role').first();
    return user?.role === 'SUPER_ADMIN';
}

/**
 * Import default CVs — architecture CV principal / copies optimisées.
 *
 * - SUPER_ADMIN : reçoit un seul CV principal (is_primary=1) depuis cv/cv_fr.md.
 *   C'est le CV source de vérité, jamais modifié. L'IA en crée des copies
 *   optimisées pour chaque candidature.
 * - Utilisateurs normaux : aucun CV importé automatiquement.
 *   Chaque utilisateur doit importer son propre CV lors de l'inscription
 *   ou depuis la page "Mes CVs".
 */
export async function importDefaultCvs(userId = null) {
    const db = await initDb();
    const cvDir = path.join(__dirname, '..', 'cv', 'storage');
    await fs.mkdir(cvDir, { recursive: true });

    const query = userId ? db('users').where({ id: userId }) : db('users');
    const users = await query.select('id');

    for (const user of users) {
        const existingCvs = await db('cvs').where({ user_id: user.id });
        if (existingCvs.length > 0) continue;

        const isAdmin = await isSuperAdmin(db, user.id);

        if (isAdmin) {
            // Admin : import du CV principal (source de vérité)
            const srcPath = path.join(__dirname, '..', 'cv', 'cv_fr.md');
            try {
                await fs.access(srcPath);
                const destPath = path.join(cvDir, `${user.id}_cv_fr.md`);
                await fs.copyFile(srcPath, destPath);
                await db('cvs').insert({
                    user_id: user.id,
                    name: 'CV Principal',
                    path: destPath,
                    lang: 'fr',
                    is_active: 1,
                    is_primary: 1
                });
                console.log(`  ✓ Imported master CV for admin user ${user.id}`);
            } catch (err) {
                console.warn(`  ⚠ Could not import master CV for admin ${user.id}: ${err.message}`);
            }
        } else {
            // Utilisateur normal : aucun CV importé automatiquement.
            // Il doit importer son propre CV manuellement.
            console.log(`  ℹ No CV imported for user ${user.id} (must upload their own CV)`);
        }
    }
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
    importDefaultCvs()
        .then(() => {
            console.log('✅ Default CVs imported successfully.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Failed to import default CVs:', err);
            process.exit(1);
        });
}
