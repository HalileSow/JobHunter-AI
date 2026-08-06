import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let directory;
let db;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function clearTables(localDb) {
    await localDb('application_attempts').del();
    await localDb('job_logs').del();
    await localDb('jobs').del();
    await localDb('search_runs').del();
    await localDb('scheduled_searches').del();
    await localDb('cvs').del();
    await localDb('profile').del();
}

before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-scheduler-'));
    process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
});

after(async () => {
    const { defaultRegistry } = await import('../providers/registry.js');
    defaultRegistry.providers.delete('test-scheduled-provider');

    if (db) {
        await db.destroy();
    }
    delete process.env.JOBHUNTER_DB_PATH;
    await rm(directory, { recursive: true, force: true });
});

test('executeScheduledSearchRun persiste les métriques de recherche planifiée', async () => {
    const { initDb } = await import('../db.js');
    const { executeScheduledSearchRun } = await import('../scheduled_search_service.js');
    const { defaultRegistry } = await import('../providers/registry.js');

    db = await initDb();
    await db.migrate.latest({
        directory: path.join(__dirname, '../../database/migrations')
    });
    await clearTables(db);

    await db('profile').insert({
        id: 1,
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        phone: '0102030405',
        address: '1 rue du Test',
        nationality: 'FR',
        languages: '["fr"]',
        skills: '["node"]',
        experience: '["automation"]',
        education: '[]',
        availability: 'immediate'
    });

    const cvSourcePath = path.join(directory, 'scheduled_cv.md');
    await writeFile(cvSourcePath, '# CV source\n\nExperience');

    await db('cvs').insert({
        name: 'CV source',
        path: cvSourcePath,
        is_active: 1
    });

    const [scheduleId] = await db('scheduled_searches').insert({
        name: 'Recherche planifiée',
        country: 'France',
        title: 'Développeur Node.js',
        keywords: 'Node',
        lang: 'fr',
        cron_expression: '0 * * * *',
        enabled: 1
    });

    const [runId] = await db('search_runs').insert({
        country: 'France',
        title: 'Développeur Node.js',
        keywords: 'Node',
        lang: 'fr',
        status: 'queued'
    });

    const providerId = 'test-scheduled-provider';
    defaultRegistry.providers.set(providerId, {
        id: providerId,
        name: 'Test Scheduled Provider',
        enabled: true,
        supportsCountry: () => true,
        async searchJobs() {
            return [
                {
                    title: 'Développeur Node.js',
                    company: 'Example Corp',
                    link: 'https://example.com/jobs/1',
                    location: 'Paris',
                    city: 'Paris',
                    salary: '50000',
                    contract_type: 'CDI',
                    experience_level: 'mid',
                    remote: 'on_site',
                    job_type: 'full_time',
                    date_posted: '2026-08-02',
                    provider: providerId,
                    provider_name: 'Test Scheduled Provider',
                    description: 'Job one'
                },
                {
                    title: 'Développeur Node.js',
                    company: 'Example Corp',
                    link: 'https://example.com/jobs/2',
                    location: 'Paris',
                    city: 'Paris',
                    salary: '50000',
                    contract_type: 'CDI',
                    experience_level: 'mid',
                    remote: 'on_site',
                    job_type: 'full_time',
                    date_posted: '2026-08-02',
                    provider: providerId,
                    provider_name: 'Test Scheduled Provider',
                    description: 'Job duplicate'
                }
            ];
        },
        supportsAutoApply: () => false
    });

    const result = await executeScheduledSearchRun({
        runId,
        scheduleId,
        nextRunAt: '2026-08-02T10:00:00.000Z',
        country: 'France',
        title: 'Développeur Node.js',
        keywords: 'Node',
        lang: 'fr',
        selectedProviderIds: [providerId],
        userId: 1
    });

    assert.equal(result.success, true);
    assert.equal(result.jobsFound, 1);
    assert.equal(result.jobsSaved, 1);
    assert.equal(result.rawJobsFound, 2);
    assert.equal(result.uniqueJobsFound, 1);
    assert.equal(result.jobsAnalyzed, 1);

    const storedRun = await db('search_runs').where({ id: runId }).first();
    assert.equal(storedRun.status, 'completed');
    assert.equal(storedRun.raw_jobs_count, 2);
    assert.equal(storedRun.unique_jobs_count, 1);
    assert.equal(storedRun.analyzed_jobs_count, 1);
    assert.equal(storedRun.saved_jobs_count, 1);

    const storedSchedule = await db('scheduled_searches').where({ id: scheduleId }).first();
    assert.equal(storedSchedule.last_status, 'success');
    assert.equal(storedSchedule.total_runs, 1);
    assert.equal(storedSchedule.last_raw_jobs_count, 2);
    assert.equal(storedSchedule.last_unique_jobs_count, 1);
    assert.equal(storedSchedule.last_analyzed_jobs_count, 1);
    assert.equal(storedSchedule.last_new_jobs_count, 1);

    const insertedJobs = await db('jobs').select('id', 'pdf_path');
    assert.equal(insertedJobs.length, 1);
    if (insertedJobs[0].pdf_path) await rm(insertedJobs[0].pdf_path, { force: true });

    const insertedAttempt = await db('application_attempts').count({ count: 'id' }).first();
    assert.equal(Number(insertedAttempt.count), 0);
});
