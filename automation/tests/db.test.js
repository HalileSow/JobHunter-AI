import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let directory;

before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-db-'));
    process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
});

after(async () => {
    delete process.env.JOBHUNTER_DB_PATH;
    await rm(directory, { recursive: true, force: true });
});

test('initialise le schéma complet et enregistre une offre', async () => {
    const { initDb } = await import('../db.js');
    const db = await initDb();

    const columns = await db.all('PRAGMA table_info(jobs)');
    assert.deepEqual(
        ['salary', 'contract_type', 'date_posted', 'selected_cv_id', 'pdf_path'].every((name) => columns.some((column) => column.name === name)),
        true
    );

    await db.run(
        'INSERT INTO jobs (title, company, score, salary, selected_cv_id, pdf_path) VALUES (?, ?, ?, ?, ?, ?)',
        ['Développeur Node.js', 'Exemple', 82, '50000', 1, '/tmp/letter.pdf']
    );
    const job = await db.get('SELECT title, score, pdf_path FROM jobs');
    assert.deepEqual(job, { title: 'Développeur Node.js', score: 82, pdf_path: '/tmp/letter.pdf' });

    const searchRuns = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'search_runs'");
    assert.equal(searchRuns.length, 1);
    const cv = await db.get('SELECT name, is_active FROM cvs');
    assert.deepEqual(cv, { name: 'CV français', is_active: 1 });
    await db.close();
});
