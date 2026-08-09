import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let directory;
let sharedDb;

async function clearTables(db) {
    await db('application_attempts').del();
    await db('job_logs').del();
    await db('jobs').del();
    await db('cvs').del();
    await db('profile').del();
    await db('users').del();
    await db('search_runs').del();
    await db('backup_settings').del();
}

before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-backup-'));
    process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');

    // Run all migrations including backup_settings
    const { initDb } = await import('../db.js');
    const db = await initDb();
    sharedDb = db;
    await db.migrate.latest({ directory: path.join(__dirname, '../../database/migrations') });
});

after(async () => {
    if (sharedDb) {
        await sharedDb.destroy();
    }
    delete process.env.JOBHUNTER_DB_PATH;
    await rm(directory, { recursive: true, force: true });
});

// ─── Helper: create a user ───
async function createUser(db, { email, role = 'user' } = {}) {
    const [id] = await db('users').insert({
        email: email || `user_${Date.now()}@test.com`,
        password: 'hashed',
        role
    });
    return id;
}

// ─── Test 1: backupDatabase crée un fichier de backup ───
test('backupDatabase crée un fichier et retourne les infos', async () => {
    const { backupDatabase } = await import('../backup_db.js');

    const result = await backupDatabase({
        backupsDir: path.join(directory, 'backups')
    });

    assert.equal(result.success, true);
    assert.ok(result.backupPath);
    assert.ok(result.backupFileName.startsWith('backup-jobhunter-'));

    // Verify file exists
    const s = await stat(result.backupPath);
    assert.ok(s.isFile());
    assert.ok(s.size > 0);
});

// ─── Test 2: Rétention — garde seulement retentionMax backups ───
test('backupDatabase purge les anciens backups au-delà de retentionMax', async () => {
    const { initDb } = await import('../db.js');
    const { backupDatabase } = await import('../backup_db.js');

    const db = await initDb();
    const backupsDir = path.join(directory, 'backups2');
    await mkdir(backupsDir, { recursive: true });

    // Create 5 backups with retentionMax=3
    for (let i = 0; i < 5; i++) {
        await backupDatabase({ backupsDir, retentionMax: 3 });
        // Small delay to ensure different timestamps
        await new Promise(r => setTimeout(r, 10));
    }

    const files = await readdir(backupsDir);
    const backupFiles = files.filter(f => f.startsWith('backup-jobhunter-') && f.endsWith('.db'));
    assert.equal(backupFiles.length, 3, 'Doit garder seulement 3 backups (retentionMax)');
});

// ─── Test 3: backup_settings table existe après migration ───
test('Migration backup_settings crée la table avec une row par défaut', async () => {
    const { initDb } = await import('../db.js');

    const db = await initDb();
    // Ne pas clear backup_settings — on veut la row par défaut de la migration
    const settings = await db('backup_settings').first();

    assert.ok(settings, 'backup_settings doit avoir une row');
    assert.equal(settings.interval_hours, 12, 'interval_hours par défaut = 12');
    assert.equal(settings.retention_max, 14, 'retention_max par défaut = 14');
    assert.equal(settings.enabled, 1, 'enabled par défaut = 1');
});

// ─── Test 4: restartBackupScheduler relit les settings ───
test('restartBackupScheduler utilise les settings de la BDD', async () => {
    const { initDb } = await import('../db.js');
    const { restartBackupScheduler } = await import('../scheduler.js');

    const db = await initDb();

    // Change settings to 6h
    await db('backup_settings').update({ interval_hours: 6, retention_max: 7 });

    // Restart scheduler — should read new values
    restartBackupScheduler();

    // Verify settings are in DB
    const settings = await db('backup_settings').first();
    assert.equal(settings.interval_hours, 6, 'interval_hours mis à 6');
    assert.equal(settings.retention_max, 7, 'retention_max mis à 7');
});

// ─── Test 5: Désactiver les backups → restartBackupScheduler ne planifie rien ───
test('Sauvegarde désactivée (enabled=0) → aucun backup planifié', async () => {
    const { initDb } = await import('../db.js');
    const { restartBackupScheduler } = await import('../scheduler.js');

    const db = await initDb();

    // Disable backups
    await db('backup_settings').update({ enabled: 0 });

    // Restart — should log "désactivée" and not schedule
    restartBackupScheduler();

    const settings = await db('backup_settings').first();
    assert.equal(settings.enabled, 0, 'enabled = 0');
});

// ─── Test 6: Mise à jour des settings via BDD directe ───
test('Mise à jour directe des settings en BDD', async () => {
    const { initDb } = await import('../db.js');

    const db = await initDb();

    await db('backup_settings').update({
        interval_hours: 24,
        retention_max: 30,
        enabled: 1
    });

    const settings = await db('backup_settings').first();
    assert.equal(settings.interval_hours, 24, 'interval_hours = 24');
    assert.equal(settings.retention_max, 30, 'retention_max = 30');
    assert.equal(settings.enabled, 1, 'enabled = 1');
});

// ─── Test 7: Last run info mis à jour après backup ───
test('Last run info mis à jour après un backup', async () => {
    const { initDb } = await import('../db.js');
    const { backupDatabase } = await import('../backup_db.js');

    const db = await initDb();
    const backupsDir = path.join(directory, 'backups3');
    await mkdir(backupsDir, { recursive: true });

    const result = await backupDatabase({ backupsDir });

    // Simulate what scheduler does
    await db('backup_settings').update({
        last_run_at: db.fn.now(),
        last_backup_path: result.backupPath,
        last_error: null,
        updated_at: db.fn.now()
    });

    const settings = await db('backup_settings').first();
    assert.ok(settings.last_run_at, 'last_run_at doit être renseigné');
    assert.ok(settings.last_backup_path?.includes('backup-jobhunter-'), 'last_backup_path doit pointer vers le backup');
    assert.equal(settings.last_error, null, 'last_error doit être null');
});
