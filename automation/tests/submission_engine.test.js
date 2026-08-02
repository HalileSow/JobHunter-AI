import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
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
}

before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-apply-'));
    process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
});

after(async () => {
    if (sharedDb) {
        await sharedDb.destroy();
    }
    delete process.env.JOBHUNTER_DB_PATH;
    await rm(directory, { recursive: true, force: true });
});

test('processJobSubmission enregistre une tentative réussie avec CV adapté', async () => {
    const { initDb } = await import('../db.js');
    const { processJobSubmission } = await import('../submission_engine.js');
    const { defaultRegistry } = await import('../providers/registry.js');

    const providerId = 'test-auto-provider';
    const fakeProvider = {
        id: providerId,
        name: 'Test Auto Provider',
        enabled: true,
        supportsAutoApply: () => true,
        async submitApplication(job, candidateProfile, cvPath, letterText) {
            assert.equal(candidateProfile.email, 'ada@example.com');
            assert.ok(cvPath.endsWith('_cv.pdf'));
            assert.equal(letterText, 'Lettre sur mesure');

            return {
                success: true,
                status: 'réussie',
                confirmationId: 'ABC-123',
                applicationUrl: `${job.link}/confirmed`,
                details: 'Application sent'
            };
        },
        async prepareApplicationPack() {
            return {};
        }
    };

    defaultRegistry.providers.set(providerId, fakeProvider);

    const db = await initDb();
    sharedDb = db;
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

    const cvSourcePath = path.join(directory, 'source_cv.md');
    await writeFile(cvSourcePath, '# CV source\n\nExperience');

    const [cvId] = await db('cvs').insert({
        name: 'CV source',
        path: cvSourcePath,
        is_active: 1
    });

    await mkdir(path.join(directory, 'documents'), { recursive: true });

    const [jobId] = await db('jobs').insert({
        title: 'Dev Node.js',
        company: 'Example',
        link: 'https://example.com/apply',
        country: 'France',
        score: 88,
        letter: 'Lettre sur mesure',
        status: 'Enregistré',
        salary: '50000',
        contract_type: 'CDI',
        date_posted: '2026-08-02',
        selected_cv_id: cvId,
        pdf_path: path.join(directory, 'letter.pdf'),
        provider: providerId,
        dedup_hash: 'dedup-hash-test',
        auto_apply_supported: 1
    });

    const result = await processJobSubmission(jobId, {
        documentOutputDir: path.join(directory, 'documents')
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'Soumis');

    const attempt = await db('application_attempts').where({ job_id: jobId }).first();
    assert.ok(attempt);
    assert.equal(attempt.provider, providerId);
    assert.equal(attempt.mode, 'auto');
    assert.equal(attempt.status, 'réussie');
    assert.equal(attempt.confirmation_id, 'ABC-123');
    assert.equal(attempt.application_url, 'https://example.com/apply/confirmed');
    assert.match(attempt.tailored_cv_path, /_cv\.pdf$/);

    const updatedJob = await db('jobs').where({ id: jobId }).first();
    assert.equal(updatedJob.status, 'Soumis');

    defaultRegistry.providers.delete(providerId);
});

test('processJobSubmission enregistre une tentative préparée quand l\'auto-apply est indisponible', async () => {
    const { initDb } = await import('../db.js');
    const { processJobSubmission } = await import('../submission_engine.js');
    const { defaultRegistry } = await import('../providers/registry.js');

    const providerId = 'test-prepared-provider';
    const fakeProvider = {
        id: providerId,
        name: 'Test Prepared Provider',
        enabled: true,
        supportsAutoApply: () => false,
        async prepareApplicationPack(job, candidateProfile, cvPath, letterText) {
            assert.equal(candidateProfile.email, 'ada@example.com');
            assert.ok(cvPath.endsWith('_cv.pdf'));
            assert.equal(letterText, 'Lettre sur mesure');

            return {
                providerId,
                providerName: this.name,
                applyUrl: job.link,
                cvPath,
                letterText,
                instructions: 'Préparation manuelle'
            };
        }
    };

    defaultRegistry.providers.set(providerId, fakeProvider);

    const db = await initDb();
    sharedDb = db;
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

    const cvSourcePath = path.join(directory, 'source_cv_prepared.md');
    await writeFile(cvSourcePath, '# CV source\n\nExperience');

    const [cvId] = await db('cvs').insert({
        name: 'CV source',
        path: cvSourcePath,
        is_active: 1
    });

    const [jobId] = await db('jobs').insert({
        title: 'Dev Node.js',
        company: 'Example',
        link: 'https://example.com/apply',
        country: 'France',
        score: 88,
        letter: 'Lettre sur mesure',
        status: 'Enregistré',
        salary: '50000',
        contract_type: 'CDI',
        date_posted: '2026-08-02',
        selected_cv_id: cvId,
        pdf_path: path.join(directory, 'letter.pdf'),
        provider: providerId,
        dedup_hash: 'dedup-hash-test-2',
        auto_apply_supported: 0
    });

    const result = await processJobSubmission(jobId, {
        documentOutputDir: path.join(directory, 'documents')
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'En attente de confirmation');

    const attempt = await db('application_attempts').where({ job_id: jobId }).first();
    assert.ok(attempt);
    assert.equal(attempt.mode, 'prepared');
    assert.equal(attempt.status, 'en attente');

    const updatedJob = await db('jobs').where({ id: jobId }).first();
    assert.equal(updatedJob.status, 'En attente de confirmation');

    defaultRegistry.providers.delete(providerId);
});
