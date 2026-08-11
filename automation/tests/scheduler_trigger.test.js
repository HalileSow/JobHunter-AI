import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let directory;
let db;

async function clearTables(localDb) {
    await localDb('application_attempts').del();
    await localDb('job_logs').del();
    await localDb('jobs').del();
    await localDb('search_runs').del();
    await localDb('scheduled_searches').del();
    await localDb('cvs').del();
    await localDb('profile').del();
    await localDb('users').del();
}

before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-schedtrigger-'));
    process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');

    const { initDb } = await import('../db.js');
    db = await initDb();
    await db.migrate.latest({ directory: path.join(__dirname, '../../database/migrations') });
});

after(async () => {
    const { defaultRegistry } = await import('../providers/registry.js');
    defaultRegistry.providers.delete('test-sched-provider');

    if (db) await db.destroy();
    delete process.env.JOBHUNTER_DB_PATH;
    await rm(directory, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════
// matchesCron
// ═══════════════════════════════════════════════════════════
test('matchesCron — wildcard * match toute valeur', () => {
    const { matchesCron } = require_sync_import();
    const now = new Date(2026, 7, 9, 14, 30); // 9 août 2026, 14:30
    assert.equal(matchesCron('* * * * *', now), true);
});

test('matchesCron — minute exacte', () => {
    const { matchesCron } = require_sync_import();
    const now = new Date(2026, 7, 9, 14, 0);
    assert.equal(matchesCron('0 * * * *', now), true);
    assert.equal(matchesCron('30 * * * *', now), false);
});

test('matchesCron — step */N', () => {
    const { matchesCron } = require_sync_import();
    const now15 = new Date(2026, 7, 9, 14, 15);
    const now20 = new Date(2026, 7, 9, 14, 20);
    assert.equal(matchesCron('*/15 * * * *', now15), true);
    assert.equal(matchesCron('*/15 * * * *', now20), false);
});

test('matchesCron — range 1-5 (lundi-vendredi)', () => {
    const { matchesCron } = require_sync_import();
    const monday = new Date(2026, 7, 10, 9, 0); // lundi = day 1
    const saturday = new Date(2026, 7, 15, 9, 0); // samedi = day 6
    assert.equal(matchesCron('0 9 * * 1-5', monday), true);
    assert.equal(matchesCron('0 9 * * 1-5', saturday), false);
});

test('matchesCron — list 1,5,10', () => {
    const { matchesCron } = require_sync_import();
    const at5 = new Date(2026, 7, 9, 14, 5);
    const at7 = new Date(2026, 7, 9, 14, 7);
    assert.equal(matchesCron('1,5,10 * * * *', at5), true);
    assert.equal(matchesCron('1,5,10 * * * *', at7), false);
});

// ═══════════════════════════════════════════════════════════
// computeNextRun
// ═══════════════════════════════════════════════════════════
test('computeNextRun — hourly retourne la prochaine heure à :00', () => {
    const { computeNextRun } = require_sync_import();
    const now = new Date(2026, 7, 9, 14, 30);
    const next = computeNextRun('0 * * * *', now);
    assert.ok(next);
    assert.equal(next.getHours(), 15);
    assert.equal(next.getMinutes(), 0);
});

test('computeNextRun — daily retourne demain à 00:00', () => {
    const { computeNextRun } = require_sync_import();
    const now = new Date(2026, 7, 9, 14, 30);
    const next = computeNextRun('0 0 * * *', now);
    assert.ok(next);
    assert.equal(next.getDate(), 10);
    assert.equal(next.getHours(), 0);
    assert.equal(next.getMinutes(), 0);
});

// ═══════════════════════════════════════════════════════════
// shouldTriggerNow
// ═══════════════════════════════════════════════════════════
test('shouldTriggerNow — cron match → trigger', () => {
    const { shouldTriggerNow } = require_sync_import();
    const now = new Date(2026, 7, 9, 14, 0);
    const schedule = { cron_expression: '0 * * * *', next_run_at: null };
    const result = shouldTriggerNow(schedule, now);
    assert.equal(result.trigger, true);
    assert.equal(result.reason, 'cron_match');
});

test('shouldTriggerNow — cron ne match PAS mais next_run_at dépassé → catch-up', () => {
    const { shouldTriggerNow } = require_sync_import();
    const now = new Date(2026, 7, 9, 14, 5); // 14:05 — cron "0 * * * *" ne matche pas
    const schedule = {
        cron_expression: '0 * * * *',
        next_run_at: new Date(2026, 7, 9, 14, 0).toISOString() // 14:00 — dans le passé
    };
    const result = shouldTriggerNow(schedule, now);
    assert.equal(result.trigger, true);
    assert.equal(result.reason, 'catch_up');
});

test('shouldTriggerNow — cron ne match PAS et next_run_at dans le futur → pas de trigger', () => {
    const { shouldTriggerNow } = require_sync_import();
    const now = new Date(2026, 7, 9, 14, 5);
    const schedule = {
        cron_expression: '0 * * * *',
        next_run_at: new Date(2026, 7, 9, 15, 0).toISOString() // 15:00 — dans le futur
    };
    const result = shouldTriggerNow(schedule, now);
    assert.equal(result.trigger, false);
});

test('shouldTriggerNow — next_run_at NULL et cron ne matche pas → pas de trigger', () => {
    const { shouldTriggerNow } = require_sync_import();
    const now = new Date(2026, 7, 9, 14, 5);
    const schedule = { cron_expression: '0 * * * *', next_run_at: null };
    const result = shouldTriggerNow(schedule, now);
    assert.equal(result.trigger, false);
});

// ═══════════════════════════════════════════════════════════
// tick() — catch-up au démarrage
// ═══════════════════════════════════════════════════════════
test('tick() — exécute un schedule avec next_run_at dans le passé (catch-up)', async () => {
    const { initDb } = await import('../db.js');
    const { tick } = await import('../scheduler.js');
    const { defaultRegistry } = await import('../providers/registry.js');

    db = await initDb();
    await clearTables(db);

    // Créer un utilisateur
    const [userId] = await db('users').insert({
        email: 'sched-test@catch.test',
        password: 'hashed',
        role: 'user'
    });

    // Créer un schedule avec next_run_at dans le passé
    const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // il y a 2h
    const [scheduleId] = await db('scheduled_searches').insert({
        name: 'Europe travail',
        country: 'Europe',
        title: 'Développeur',
        keywords: '',
        lang: 'fr',
        cron_expression: '0 * * * *',
        enabled: 1,
        providers_list: JSON.stringify(['test-sched-provider']),
        user_id: userId,
        next_run_at: pastDate,
        last_run_at: null,
        total_runs: 0
    });

    // Mock provider
    const providerId = 'test-sched-provider';
    defaultRegistry.providers.set(providerId, {
        id: providerId,
        name: 'Test Sched Provider',
        enabled: true,
        supportsCountry: () => true,
        async searchJobs() {
            return [{
                title: 'Développeur JS',
                company: 'TestCorp',
                link: 'https://test.com/job/1',
                location: 'Berlin',
                city: 'Berlin',
                salary: '60000',
                contract_type: 'CDI',
                experience_level: 'mid',
                remote: 'remote',
                job_type: 'full_time',
                date_posted: '2026-08-09',
                provider: providerId,
                provider_name: 'Test Sched Provider',
                description: 'Test job for scheduler catch-up'
            }];
        },
        supportsAutoApply: () => false
    });

    // Exécuter le tick
    await tick();

    // Vérifier que le schedule a été exécuté
    const updated = await db('scheduled_searches').where({ id: scheduleId }).first();
    assert.equal(updated.total_runs, 1, 'total_runs doit être 1 après catch-up');
    assert.ok(updated.last_run_at, 'last_run_at doit être renseigné');
    assert.equal(updated.last_status, 'success');
    assert.ok(updated.next_run_at, 'next_run_at doit être recalculé');

    // Vérifier que le search_run a été créé
    const runs = await db('search_runs').where({ user_id: userId });
    assert.ok(runs.length >= 1, 'Au moins un search_run doit exister');
    assert.equal(runs[0].status, 'completed');

    // Vérifier que des offres ont été trouvées
    const jobs = await db('jobs').where({ user_id: userId });
    assert.ok(jobs.length >= 1, 'Au moins une offre doit être enregistrée');
});

test('tick() — ne ré-exécute PAS un schedule déjà exécuté dans les 55s', async () => {
    const { initDb } = await import('../db.js');
    const { tick } = await import('../scheduler.js');

    db = await initDb();
    await clearTables(db);

    const [userId] = await db('users').insert({
        email: 'sched-test@dedup.test',
        password: 'hashed',
        role: 'user'
    });

    // Schedule avec last_run_at = maintenant (moins de 55s)
    await db('scheduled_searches').insert({
        name: 'Recent run',
        country: 'France',
        title: 'Test',
        cron_expression: '* * * * *', // chaque minute
        enabled: 1,
        user_id: userId,
        last_run_at: new Date().toISOString(),
        total_runs: 1,
        last_status: 'success'
    });

    const runsBefore = await db('search_runs').count({ count: 'id' }).first();

    await tick();

    const runsAfter = await db('search_runs').count({ count: 'id' }).first();
    assert.equal(Number(runsBefore.count), Number(runsAfter.count), 'Aucun nouveau run ne doit être créé');
});

// ═══════════════════════════════════════════════════════════
// Helper: import synchrone des fonctions pures du scheduler
// ═══════════════════════════════════════════════════════════
function require_sync_import() {
    // On utilise un cache module pour éviter les imports async dans les tests synchrones
    return schedulerModule;
}

let schedulerModule;
before(async () => {
    schedulerModule = await import('../scheduler.js');
});
