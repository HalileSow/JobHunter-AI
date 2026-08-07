import { initDb } from './db.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CV_FILES = ['cv_fr.md', 'cv_en.md', 'cv_de.md'];
const CV_META = {
    cv_fr: { name: 'CV Français', lang: 'fr' },
    cv_en: { name: 'CV English', lang: 'en' },
    cv_de: { name: 'CV Deutsch', lang: 'de' }
};

export async function importDefaultCvs(userId = null) {
    const db = await initDb();
    const cvDir = path.join(__dirname, '..', 'cv', 'storage');
    await fs.mkdir(cvDir, { recursive: true });

    const query = userId ? db('users').where({ id: userId }) : db('users');
    const users = await query.select('id');

    for (const user of users) {
        const existingCvs = await db('cvs').where({ user_id: user.id });
        if (existingCvs.length > 0) continue;

        for (const file of CV_FILES) {
            const srcPath = path.join(__dirname, '..', 'cv', file);
            const baseName = file.replace('.md', '');
            const meta = CV_META[baseName] || { name: file, lang: 'fr' };

            try {
                await fs.access(srcPath);
            } catch {
                continue;
            }

            const destPath = path.join(cvDir, `${user.id}_${file}`);
            try {
                await fs.copyFile(srcPath, destPath);
                await db('cvs').insert({
                    user_id: user.id,
                    name: meta.name,
                    path: destPath,
                    lang: meta.lang,
                    is_active: 0
                });
                console.log(`  ✓ Imported ${meta.name} for user ${user.id}`);
            } catch (err) {
                console.warn(`  ⚠ Could not import ${file} for user ${user.id}: ${err.message}`);
            }
        }

        const frCv = await db('cvs').where({ user_id: user.id }).where('name', 'like', '%Français%').first();
        if (frCv) {
            await db('cvs').where({ user_id: user.id }).update({ is_active: 0 });
            await db('cvs').where({ id: frCv.id }).update({ is_active: 1 });
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
