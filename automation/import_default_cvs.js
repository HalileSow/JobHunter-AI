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
 * - SUPER_ADMIN : reçoit un CV principal (is_primary=1) depuis cv/cv_fr.md.
 *   Si un CV existe déjà depuis cv/cv_fr.md, il est marqué comme primary.
 *   Sinon, le CV source est importé. Les CVs existants non-primary sont conservés
 *   mais is_primary=0 leur est garanti.
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

    const srcPath = path.join(__dirname, '..', 'cv', 'cv_fr.md');
    let srcResolved = null;
    try {
        srcResolved = path.resolve(srcPath);
    } catch {
        // ignore
    }

    const query = userId ? db('users').where({ id: userId }) : db('users');
    const users = await query.select('id');

    for (const user of users) {
        const isAdmin = await isSuperAdmin(db, user.id);

        if (!isAdmin) {
            // Utilisateur normal : aucun CV importé automatiquement.
            // Il doit importer son propre CV manuellement.
            console.log(`  ℹ No CV imported for user ${user.id} (must upload their own CV)`);
            continue;
        }

        // --- SUPER_ADMIN logic ---

        // 1. Check if already has a primary CV
        const existingPrimary = await db('cvs')
            .where({ user_id: user.id, is_primary: 1 })
            .first();

        if (existingPrimary) {
            // Already has a primary CV — ensure any other CVs are demoted
            await db('cvs')
                .where({ user_id: user.id })
                .where('id', '!=', existingPrimary.id)
                .update({ is_primary: 0 });
            console.log(`  ✓ Admin user ${user.id} already has primary CV #${existingPrimary.id}`);
            continue;
        }

        // 2. No primary CV yet — try to find an existing CV from the cv_fr.md source
        let existingSourceCv = null;
        if (srcResolved) {
            const cvFrStorageName = `${user.id}_cv_fr.md`;
            existingSourceCv = await db('cvs')
                .where({ user_id: user.id })
                .andWhere((qb) => {
                    qb.where('path', srcResolved)
                        .orWhere('path', path.join(cvDir, cvFrStorageName))
                        .orWhere('name', 'CV Français')
                        .orWhere('name', 'CV Principal');
                })
                .orderBy('created_at', 'asc') // prefer oldest (likely the original import)
                .first();
        }

        if (existingSourceCv) {
            // Mark the source CV as primary, demote all others
            await db.transaction(async (trx) => {
                await trx('cvs')
                    .where({ user_id: user.id })
                    .where('id', '!=', existingSourceCv.id)
                    .update({ is_primary: 0 });
                await trx('cvs')
                    .where({ id: existingSourceCv.id })
                    .update({ is_primary: 1, name: 'CV Principal', lang: 'fr' });
            });
            console.log(`  ✓ Marked existing CV #${existingSourceCv.id} as primary for admin user ${user.id}`);
            continue;
        }

        // 3. No existing source CV found — check if there are ANY existing CVs
        const existingCvs = await db('cvs').where({ user_id: user.id });

        if (existingCvs.length > 0) {
            // Has CVs but none match the source — mark the oldest non-optimized one as primary
            // Prefer CVs that don't look like optimized copies (no "_optimized_" in filename)
            let candidate = existingCvs.find((cv) => {
                return !cv.path?.includes('_optimized_') && !cv.name?.includes('Optimisé');
            });
            if (!candidate) {
                // Fallback to the oldest CV
                candidate = existingCvs.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))[0];
            }

            if (candidate) {
                await db.transaction(async (trx) => {
                    await trx('cvs')
                        .where({ user_id: user.id })
                        .where('id', '!=', candidate.id)
                        .update({ is_primary: 0 });
                    await trx('cvs')
                        .where({ id: candidate.id })
                        .update({ is_primary: 1 });
                });
                console.log(`  ✓ Marked existing CV #${candidate.id} as primary for admin user ${user.id}`);
                continue;
            }
        }

        // 4. No CVs at all — import from cv/cv_fr.md
        // NEVER delete existing CVs. Only import if the user truly has none.
        try {
            await fs.access(srcPath);
            const destPath = path.join(cvDir, `${user.id}_cv_fr.md`);

            // Double-check: do NOT import if any CVs exist (race condition safety)
            const finalCheck = await db('cvs').where({ user_id: user.id }).first();
            if (finalCheck) {
                // CVs appeared since our last check — just pick the oldest non-optimized as primary
                const allCvs = await db('cvs').where({ user_id: user.id }).select('*');
                let candidate = allCvs.find((cv) =>
                    !cv.path?.includes('_optimized_') && !cv.name?.includes('Optimisé')
                ) || allCvs.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))[0];

                if (candidate) {
                    await db.transaction(async (trx) => {
                        await trx('cvs')
                            .where({ user_id: user.id })
                            .where('id', '!=', candidate.id)
                            .update({ is_primary: 0 });
                        await trx('cvs')
                            .where({ id: candidate.id })
                            .update({ is_primary: 1 });
                    });
                }
                console.log(`  ✓ Admin user ${user.id} has CVs, no import needed. Primary: #${candidate?.id}`);
                continue;
            }

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
