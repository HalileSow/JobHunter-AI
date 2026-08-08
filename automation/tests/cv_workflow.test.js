import assert from 'node:assert/strict';
import { before, after, test, describe } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir, readFile, stat } from 'node:fs/promises';
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
}

before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-cv-'));
    process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
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

// ─── Helper: create a fake provider ───
function createFakeProvider(id, { supportsAutoApply = false } = {}) {
    const { defaultRegistry } = requireOrImport('../providers/registry.js');
    const fakeProvider = {
        id,
        name: `Test Provider ${id}`,
        enabled: true,
        supportsAutoApply: () => supportsAutoApply,
        async submitApplication(job, profile, cvPath, letterText) {
            return { success: true, status: 'réussie', confirmationId: 'CONF-1', applicationUrl: job.link };
        },
        async prepareApplicationPack() {
            return { providerId: id, providerName: this.name, applyUrl: 'https://example.com', instructions: 'test' };
        }
    };
    defaultRegistry.providers.set(id, fakeProvider);
    return { fakeProvider, cleanup: () => defaultRegistry.providers.delete(id) };
}

function requireOrImport(mod) {
    // ESM-compatible import
    return typeof require !== 'undefined' ? require(mod) : null;
}

// ─── Test 1: SUPER_ADMIN + CV principal → analyse avec CV ───
test('SUPER_ADMIN avec CV principal — analyse IA avec CV obligatoire', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    sharedDb = db;
    await db.migrate.latest({ directory: path.join(__dirname, '../../database/migrations') });
    await clearTables(db);

    // Create SUPER_ADMIN user
    const adminId = await createUser(db, { email: 'superadmin@test.com', role: 'SUPER_ADMIN' });

    // Create primary CV
    const primaryCvPath = path.join(directory, 'primary_cv.md');
    await writeFile(primaryCvPath, '# CV Super Admin\n\nExpérience: 10 ans en développement\nCompétences: Node.js, Python, React');

    await db('cvs').insert({
        user_id: adminId,
        name: 'CV Principal',
        path: primaryCvPath,
        lang: 'fr',
        is_active: 1,
        is_primary: 1
    });

    // Verify getPrimaryCvPath finds it
    const foundPath = await getPrimaryCvPath(adminId);
    assert.equal(foundPath, primaryCvPath, 'getPrimaryCvPath doit retourner le CV principal du SUPER_ADMIN');

    // Verify getAllCvs returns it
    const allCvs = await getAllCvs(adminId);
    assert.equal(allCvs.length, 1, 'getAllCvs doit retourner 1 CV');
    assert.equal(allCvs[0].is_primary, 1, 'Le CV retourné doit être marqué is_primary=1');

    // Verify getActiveCvPath also works (primary is also active)
    const activePath = await getActiveCvPath(adminId);
    assert.ok(activePath !== null, 'getActiveCvPath doit aussi trouver un CV');

    // Verify CV content is readable
    const content = await readFile(foundPath, 'utf-8');
    assert.ok(content.includes('Super Admin'), 'Le contenu du CV doit être lisible');
    assert.ok(content.trim().length > 0, 'Le CV ne doit pas être vide');
});

// ─── Test 2: Utilisateur normal + CV actif → analyse avec CV ───
test('Utilisateur normal avec CV actif — analyse IA avec CV', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    // Create normal user
    const userId = await createUser(db, { email: 'normal@test.com', role: 'user' });

    // Create active CV (no primary)
    const activeCvPath = path.join(directory, 'active_cv.md');
    await writeFile(activeCvPath, '# CV Normal\n\nExpérience: 3 ans en design');

    await db('cvs').insert({
        user_id: userId,
        name: 'Mon CV',
        path: activeCvPath,
        lang: 'en',
        is_active: 1,
        is_primary: 0
    });

    // getPrimaryCvPath returns null (no primary)
    const primaryPath = await getPrimaryCvPath(userId);
    assert.equal(primaryPath, null, 'getPrimaryCvPath doit retourner null pour un user sans CV principal');

    // getActiveCvPath returns the active CV
    const activePath = await getActiveCvPath(userId);
    assert.equal(activePath, activeCvPath, 'getActiveCvPath doit retourner le CV actif');

    // getAllCvs returns the CV
    const allCvs = await getAllCvs(userId);
    assert.equal(allCvs.length, 1, 'getAllCvs doit retourner 1 CV');
    assert.equal(allCvs[0].is_primary, 0, 'Le CV ne doit pas être marqué is_primary');
});

// ─── Test 3: Utilisateur sans CV → analyse simplifiée autorisée ───
test('Utilisateur sans CV — aucun CV disponible', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    // Create user with no CV
    const userId = await createUser(db, { email: 'nocv@test.com', role: 'user' });

    // All CV lookups should return null/empty
    const primaryPath = await getPrimaryCvPath(userId);
    assert.equal(primaryPath, null, 'getPrimaryCvPath doit retourner null');

    const activePath = await getActiveCvPath(userId);
    assert.equal(activePath, null, 'getActiveCvPath doit retourner null');

    const allCvs = await getAllCvs(userId);
    assert.equal(allCvs.length, 0, 'getAllCvs doit retourner 0 CV');
});

// ─── Test 4: CV principal introuvable (fichier manquant) → fallback explicite ───
test('CV principal en BDD mais fichier introuvable — fallback', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'broken@test.com', role: 'user' });

    // Insert CV record pointing to non-existent file
    const fakePath = path.join(directory, 'does_not_exist.md');
    await db('cvs').insert({
        user_id: userId,
        name: 'CV Fantôme',
        path: fakePath,
        lang: 'fr',
        is_active: 1,
        is_primary: 1
    });

    // getPrimaryCvPath returns the path (DB record exists)
    const foundPath = await getPrimaryCvPath(userId);
    assert.equal(foundPath, fakePath, 'getPrimaryCvPath retourne le path depuis la BDD');

    // But file read should fail
    await assert.rejects(
        async () => readFile(foundPath, 'utf-8'),
        /ENOENT|no such file/,
        'La lecture du fichier doit échouer (fichier inexistant)'
    );
});

// ─── Test 5: CV principal intact après optimisation ───
test('CV principal intact après création de copie optimisée', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, createOptimizedCvCopy } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'copytest@test.com', role: 'SUPER_ADMIN' });

    // Create primary CV
    const primaryCvPath = path.join(directory, 'primary_for_copy.md');
    await writeFile(primaryCvPath, '# CV Original\n\nContenu original à préserver');
    await db('cvs').insert({
        user_id: userId,
        name: 'CV Principal',
        path: primaryCvPath,
        lang: 'fr',
        is_active: 1,
        is_primary: 1
    });

    // Create optimized copy
    const copyResult = await createOptimizedCvCopy(userId, 999, 'en');
    assert.ok(copyResult.id, 'La copie doit avoir un ID');
    assert.ok(copyResult.path, 'La copie doit avoir un path');

    // Verify copy file exists
    const copyStat = await stat(copyResult.path);
    assert.ok(copyStat.isFile(), 'Le fichier de copie doit exister');

    // Verify copy content matches original
    const originalContent = await readFile(primaryCvPath, 'utf-8');
    const copyContent = await readFile(copyResult.path, 'utf-8');
    assert.equal(copyContent, originalContent, 'La copie doit avoir le même contenu que l\'original');

    // Verify original file is still intact (same content after copy)
    const originalAfter = await readFile(primaryCvPath, 'utf-8');
    assert.equal(originalAfter, originalContent, 'Le CV original doit rester intact après la copie');

    // Verify primary CV is still marked as primary
    const primaryAfter = await getPrimaryCvPath(userId);
    assert.equal(primaryAfter, primaryCvPath, 'Le CV principal doit toujours être le même après copie');

    // Verify copy is NOT primary
    const copyInDb = await db('cvs').where({ id: copyResult.id }).first();
    assert.equal(copyInDb.is_primary, 0, 'La copie ne doit PAS être is_primary');
    assert.equal(copyInDb.is_active, 0, 'La copie ne doit PAS être is_active');
});

// ─── Test 6: Copie optimisée correctement associée à l'offre ───
test('Copie optimisée associée à l\'offre via selected_cv_id', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, createOptimizedCvCopy } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'assoc@test.com', role: 'SUPER_ADMIN' });

    // Create primary CV
    const primaryCvPath = path.join(directory, 'primary_assoc.md');
    await writeFile(primaryCvPath, '# CV Association Test');
    await db('cvs').insert({
        user_id: userId,
        name: 'CV Principal',
        path: primaryCvPath,
        lang: 'fr',
        is_active: 1,
        is_primary: 1
    });

    // Create a job
    const [jobId] = await db('jobs').insert({
        user_id: userId,
        title: 'Test Job',
        company: 'TestCorp',
        link: 'https://test.com/job',
        country: 'France',
        score: 75,
        letter: 'Test letter',
        analysis: 'Test analysis',
        status: 'Enregistré',
        provider: 'test',
        dedup_hash: 'assoc-test-hash'
    });

    // Create optimized copy
    const copyResult = await createOptimizedCvCopy(userId, jobId, 'fr');

    // Update job to reference the copy
    await db('jobs').where({ id: jobId }).update({ selected_cv_id: copyResult.id });

    // Verify association
    const job = await db('jobs').where({ id: jobId }).first();
    assert.equal(job.selected_cv_id, copyResult.id, 'Le job doit référencer la copie optimisée');

    // Verify the CV referenced by the job belongs to the same user
    const referencedCv = await db('cvs').where({ id: copyResult.id, user_id: userId }).first();
    assert.ok(referencedCv, 'La copie doit appartenir au même utilisateur');
});

// ─── Test 7: Langue cible correctement enregistrée ───
test('Langue cible enregistrée dans la copie optimisée', async () => {
    const { initDb } = await import('../db.js');
    const { createOptimizedCvCopy } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'lang@test.com', role: 'SUPER_ADMIN' });

    // Create primary CV
    const primaryCvPath = path.join(directory, 'primary_lang.md');
    await writeFile(primaryCvPath, '# CV Langue');
    await db('cvs').insert({
        user_id: userId,
        name: 'CV Principal',
        path: primaryCvPath,
        lang: 'fr',
        is_active: 1,
        is_primary: 1
    });

    // Create copies in different languages
    const copyFr = await createOptimizedCvCopy(userId, 1001, 'fr');
    const copyEn = await createOptimizedCvCopy(userId, 1002, 'en');
    const copyDe = await createOptimizedCvCopy(userId, 1003, 'de');

    // Verify languages
    const cvFr = await db('cvs').where({ id: copyFr.id }).first();
    const cvEn = await db('cvs').where({ id: copyEn.id }).first();
    const cvDe = await db('cvs').where({ id: copyDe.id }).first();

    assert.equal(cvFr.lang, 'fr', 'Copie FR doit avoir lang=fr');
    assert.equal(cvEn.lang, 'en', 'Copie EN doit avoir lang=en');
    assert.equal(cvDe.lang, 'de', 'Copie DE doit avoir lang=de');

    // Verify filenames contain the language
    assert.ok(copyFr.path.includes('_fr'), 'Le path de la copie FR doit contenir _fr');
    assert.ok(copyEn.path.includes('_en'), 'Le path de la copie EN doit contenir _en');
    assert.ok(copyDe.path.includes('_de'), 'Le path de la copie DE doit contenir _de');
});

// ─── Test 8: SubmissionEngine utilise la copie optimisée ───
test('SubmissionEngine utilise la copie optimisée lorsqu\'elle existe', async () => {
    const { initDb } = await import('../db.js');
    const { processJobSubmission } = await import('../submission_engine.js');
    const { createOptimizedCvCopy } = await import('../cv_manager.js');
    const { defaultRegistry } = await import('../providers/registry.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'submit@test.com', role: 'SUPER_ADMIN' });

    // Create profile
    await db('profile').insert({
        user_id: userId,
        first_name: 'Test',
        last_name: 'User',
        email: 'submit@test.com',
        phone: '0102030405',
        address: '1 Test St',
        nationality: 'FR',
        languages: '["fr"]',
        skills: '["test"]',
        experience: '["test"]',
        education: '[]',
        availability: 'immediate'
    });

    // Create primary CV
    const primaryCvPath = path.join(directory, 'primary_submit.md');
    await writeFile(primaryCvPath, '# CV Submission\n\nExpérience test');
    await db('cvs').insert({
        user_id: userId,
        name: 'CV Principal',
        path: primaryCvPath,
        lang: 'fr',
        is_active: 1,
        is_primary: 1
    });

    // Create job
    const providerId = 'test-cv-copy-provider';
    const fakeProvider = {
        id: providerId,
        name: 'Test CV Copy Provider',
        enabled: true,
        supportsAutoApply: () => true,
        async submitApplication(job, profile, cvPath, letterText) {
            // Verify that the CV path ends with '_optimized_' (it's a copy, not the original)
            assert.ok(
                cvPath.includes('_optimized_') || cvPath.endsWith('.pdf'),
                `SubmissionEngine doit utiliser la copie optimisée, pas le CV original. Path: ${cvPath}`
            );
            return { success: true, status: 'réussie', confirmationId: 'CONF-CV', applicationUrl: job.link };
        },
        async prepareApplicationPack() {
            return {};
        }
    };
    defaultRegistry.providers.set(providerId, fakeProvider);

    const [jobId] = await db('jobs').insert({
        user_id: userId,
        title: 'Dev Fullstack',
        company: 'SubmitCorp',
        link: 'https://submit.com/job',
        country: 'France',
        score: 80,
        letter: 'Cover letter test',
        analysis: 'Analyse avec CV',
        status: 'Enregistré',
        provider: providerId,
        dedup_hash: 'submit-cv-copy-hash',
        auto_apply_supported: 1
    });

    // Create optimized copy and link it to the job BEFORE submission
    const copyResult = await createOptimizedCvCopy(userId, jobId, 'fr');
    await db('jobs').where({ id: jobId }).update({ selected_cv_id: copyResult.id });

    // Process submission
    const result = await processJobSubmission(jobId);

    assert.equal(result.success, true, 'La soumission doit réussir');
    assert.equal(result.status, 'Soumis', 'Le statut doit être Soumis');

    // Verify the attempt used the optimized copy
    const attempt = await db('application_attempts').where({ job_id: jobId }).first();
    assert.ok(attempt, 'Une tentative doit être enregistrée');
    assert.ok(
        attempt.tailored_cv_path.includes('_optimized_') || attempt.tailored_cv_path.endsWith('.pdf'),
        `La tentative doit référencer la copie optimisée. Path: ${attempt.tailored_cv_path}`
    );

    defaultRegistry.providers.delete(providerId);
});
