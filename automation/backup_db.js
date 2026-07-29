import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function backupDatabase(options = {}) {
    const dbPath = options.dbPath || process.env.JOBHUNTER_DB_PATH || path.join(__dirname, '..', 'database', 'jobhunter.db');
    const backupsDir = options.backupsDir || path.join(__dirname, '..', 'database', 'backups');
    const retentionMax = options.retentionMax || 14; // nombre max de sauvegardes conservées

    if (!existsSync(dbPath)) {
        throw new Error(`Fichier de base de données introuvable à : ${dbPath}`);
    }

    await fs.mkdir(backupsDir, { recursive: true });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-jobhunter-${timestamp}.db`;
    const targetPath = path.join(backupsDir, backupFileName);

    await fs.copyFile(dbPath, targetPath);

    // Nettoyage de la rétention
    const files = await fs.readdir(backupsDir);
    const backupFiles = files
        .filter(f => f.startsWith('backup-jobhunter-') && f.endsWith('.db'))
        .map(f => path.join(backupsDir, f));

    // Trier du plus récent au plus ancien
    const fileStats = await Promise.all(
        backupFiles.map(async (file) => {
            const stat = await fs.stat(file);
            return { file, mtime: stat.mtimeMs };
        })
    );

    fileStats.sort((a, b) => b.mtime - a.mtime);

    const filesToRemove = fileStats.slice(retentionMax);
    for (const item of filesToRemove) {
        await fs.unlink(item.file).catch(() => null);
    }

    return {
        success: true,
        backupPath: targetPath,
        backupFileName,
        totalBackupsRetained: Math.min(fileStats.length, retentionMax),
        removedCount: filesToRemove.length
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    backupDatabase()
        .then((res) => {
            console.log(`✅ Sauvegarde réussie : ${res.backupFileName}`);
            console.log(`📦 Sauvegardes conservées : ${res.totalBackupsRetained} (${res.removedCount} purgée(s))`);
        })
        .catch((err) => {
            console.error(`❌ Échec de la sauvegarde : ${err.message}`);
            process.exitCode = 1;
        });
}
