import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Exécuter les migrations sur la base temporaire
    await db.migrate.latest({
        directory: path.join(__dirname, '../../database/migrations')
    });

    // Vérifier les colonnes de la table jobs
    const hasSalary = await db.schema.hasColumn('jobs', 'salary');
    const hasContractType = await db.schema.hasColumn('jobs', 'contract_type');
    const hasDatePosted = await db.schema.hasColumn('jobs', 'date_posted');
    const hasSelectedCvId = await db.schema.hasColumn('jobs', 'selected_cv_id');
    const hasPdfPath = await db.schema.hasColumn('jobs', 'pdf_path');
    const hasAttemptsTable = await db.schema.hasTable('application_attempts');

    assert.equal(hasSalary && hasContractType && hasDatePosted && hasSelectedCvId && hasPdfPath && hasAttemptsTable, true);

    // Insérer un CV
    await db('cvs').insert({
        name: 'CV français',
        path: '/tmp/cv_fr.pdf',
        is_active: 1
    });

    // Insérer un job
    await db('jobs').insert({
        title: 'Développeur Node.js',
        company: 'Exemple',
        score: 82,
        salary: '50000',
        selected_cv_id: 1,
        pdf_path: '/tmp/letter.pdf'
    });

    // Récupérer le job et vérifier
    const job = await db('jobs').select('title', 'score', 'pdf_path').first();
    assert.deepEqual(job, { title: 'Développeur Node.js', score: 82, pdf_path: '/tmp/letter.pdf' });

    // Vérifier la présence de la table search_runs
    const hasSearchRunsTable = await db.schema.hasTable('search_runs');
    assert.equal(hasSearchRunsTable, true);

    // Vérifier le CV
    const cv = await db('cvs').select('name', 'is_active').first();
    assert.deepEqual(cv, { name: 'CV français', is_active: 1 });

    await db.destroy();
});
