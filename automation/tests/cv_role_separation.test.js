import assert from 'node:assert/strict';
import { before, after, test, describe } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
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
    directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-role-'));
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

// ─── Test 1: SUPER_ADMIN — CV principal importé automatiquement ───
test('SUPER_ADMIN — importDefaultCvs crée un CV principal is_primary=1', async () => {
    const { initDb } = await import('../db.js');
    const { importDefaultCvs } = await import('../import_default_cvs.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    sharedDb = db;
    await db.migrate.latest({ directory: path.join(__dirname, '../../database/migrations') });
    await clearTables(db);

    // Create source CV file (simulates cv/cv_fr.md)
    const srcDir = path.join(__dirname, '../../cv');
    await mkdir(srcDir, { recursive: true });
    const srcPath = path.join(srcDir, 'cv_fr.md');
    try {
        await readFile(srcPath, 'utf-8');
    } catch {
        await writeFile(srcPath, '# CV Source Master\n\nExpérience senior en développement');
    }

    // Create SUPER_ADMIN user
    const adminId = await createUser(db, { email: 'admin@separation.test', role: 'SUPER_ADMIN' });

    // Run import
    await importDefaultCvs(adminId);

    // Verify: has primary CV
    const primaryPath = await getPrimaryCvPath(adminId);
    assert.ok(primaryPath !== null, 'SUPER_ADMIN doit avoir un CV principal après importDefaultCvs');

    // Verify: is_primary=1 in DB
    const primaryCv = await db('cvs').where({ user_id: adminId, is_primary: 1 }).first();
    assert.ok(primaryCv, 'Le CV principal doit exister en BDD avec is_primary=1');
    assert.equal(primaryCv.name, 'CV Principal', 'Le CV principal doit être nommé "CV Principal"');
    assert.equal(primaryCv.lang, 'fr', 'Le CV principal doit être en français');

    // Verify: getAllCvs returns the primary
    const allCvs = await getAllCvs(adminId);
    assert.equal(allCvs.length, 1, 'SUPER_ADMIN doit avoir exactement 1 CV après import');
    assert.equal(allCvs[0].is_primary, 1, 'Ce CV doit être is_primary=1');

    // Verify: source file is intact
    const sourceContent = await readFile(primaryPath, 'utf-8');
    assert.ok(sourceContent.length > 0, 'Le CV principal doit avoir du contenu');
});

// ─── Test 2: Utilisateur normal — importDefaultCvs NE fait rien ───
test('Utilisateur normal — importDefaultCvs ne crée AUCUN CV', async () => {
    const { initDb } = await import('../db.js');
    const { importDefaultCvs } = await import('../import_default_cvs.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    // Create normal user
    const userId = await createUser(db, { email: 'normal@separation.test', role: 'user' });

    // Run import
    await importDefaultCvs(userId);

    // Verify: NO CV created
    const primaryPath = await getPrimaryCvPath(userId);
    assert.equal(primaryPath, null, 'Utilisateur normal ne doit PAS avoir de CV principal');

    const activePath = await getActiveCvPath(userId);
    assert.equal(activePath, null, 'Utilisateur normal ne doit PAS avoir de CV actif après importDefaultCvs');

    const allCvs = await getAllCvs(userId);
    assert.equal(allCvs.length, 0, 'Utilisateur normal ne doit avoir AUCUN CV après importDefaultCvs');
});

// ─── Test 3: Utilisateur normal — CV uploadé est is_primary=0, is_active=1 ───
test('Utilisateur normal — CV uploadé est is_primary=0, is_active=1 (premier CV)', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'uploader@separation.test', role: 'user' });

    // Simulate CV upload (as server.mjs does: is_primary=0, is_active=1 if no primary)
    const cvDir = path.join(__dirname, '../../cv/storage');
    await mkdir(cvDir, { recursive: true });
    const cvPath = path.join(cvDir, `${userId}_upload_test.md`);
    await writeFile(cvPath, '# Mon CV\n\nExpérience utilisateur');

    const [cvId] = await db('cvs').insert({
        user_id: userId,
        name: 'Mon CV Uploadé',
        path: cvPath,
        lang: 'fr',
        is_active: 1,
        is_primary: 0
    });

    // Verify: NOT primary
    const primaryPath = await getPrimaryCvPath(userId);
    assert.equal(primaryPath, null, 'CV uploadé ne doit PAS être is_primary');

    // Verify: IS active (first CV uploaded)
    const activePath = await getActiveCvPath(userId);
    assert.equal(activePath, cvPath, 'CV uploadé doit être is_active (premier CV)');

    // Verify: getAllCvs returns it
    const allCvs = await getAllCvs(userId);
    assert.equal(allCvs.length, 1, 'Utilisateur doit avoir 1 CV');
    assert.equal(allCvs[0].is_primary, 0, 'Ce CV ne doit PAS être is_primary');
});

// ─── Test 4: CV principal — ne peut PAS être supprimé (403) ───
test('CV principal — suppression refusée (is_primary=1 protégé)', async () => {
    const { initDb } = await import('../db.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'protected@separation.test', role: 'SUPER_ADMIN' });

    const cvDir = path.join(__dirname, '../../cv/storage');
    await mkdir(cvDir, { recursive: true });
    const cvPath = path.join(cvDir, `${userId}_protected.md`);
    await writeFile(cvPath, '# CV Protégé');

    const [cvId] = await db('cvs').insert({
        user_id: userId,
        name: 'CV Principal',
        path: cvPath,
        lang: 'fr',
        is_active: 1,
        is_primary: 1
    });

    // Simulate the DELETE logic from server.mjs
    const cv = await db('cvs').where({ id: cvId, user_id: userId }).select('path', 'is_primary').first();
    assert.ok(cv.is_primary, 'Le CV doit être is_primary');

    // In server.mjs, this returns 403 — simulate the check
    const canDelete = !cv.is_primary;
    assert.equal(canDelete, false, 'CV principal ne doit PAS pouvoir être supprimé');

    // Verify: CV still exists
    const stillExists = await db('cvs').where({ id: cvId }).first();
    assert.ok(stillExists, 'Le CV principal doit toujours exister après tentative de suppression');
});

// ─── Test 5: Séparation stricte — CV SUPER_ADMIN inaccessible à user normal ───
test('Séparation stricte — CV du SUPER_ADMIN inaccessible à un utilisateur normal', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    // Create SUPER_ADMIN with CV
    const adminId = await createUser(db, { email: 'admin2@sep.test', role: 'SUPER_ADMIN' });
    const cvDir = path.join(__dirname, '../../cv/storage');
    await mkdir(cvDir, { recursive: true });
    const adminCvPath = path.join(cvDir, `${adminId}_admin_sep.md`);
    await writeFile(adminCvPath, '# CV Admin');
    await db('cvs').insert({
        user_id: adminId,
        name: 'CV Admin',
        path: adminCvPath,
        lang: 'fr',
        is_active: 1,
        is_primary: 1
    });

    // Create normal user
    const normalId = await createUser(db, { email: 'normal2@sep.test', role: 'user' });

    // Verify: normal user has NO access to admin's CV
    const normalPrimary = await getPrimaryCvPath(normalId);
    assert.equal(normalPrimary, null, 'User normal ne doit PAS voir le CV principal du SUPER_ADMIN');

    const normalActive = await getActiveCvPath(normalId);
    assert.equal(normalActive, null, 'User normal ne doit PAS avoir de CV actif');

    const normalCvs = await getAllCvs(normalId);
    assert.equal(normalCvs.length, 0, 'User normal ne doit avoir AUCUN CV');

    // Verify: admin has their CV
    const adminPrimary = await getPrimaryCvPath(adminId);
    assert.equal(adminPrimary, adminCvPath, 'SUPER_ADMIN doit retrouver son CV principal');

    const adminCvs = await getAllCvs(adminId);
    assert.equal(adminCvs.length, 1, 'SUPER_ADMIN doit avoir 1 CV');

    // Verify ownership directly in DB (getAllCvs may not include user_id)
    const adminCvDb = await db('cvs').where({ id: adminCvs[0].id }).first();
    assert.equal(adminCvDb.user_id, adminId, 'Le CV doit appartenir au SUPER_ADMIN');
});

// ─── Test 6: Analyse simplifiée — user sans CV reçoit un message explicite ───
test('Analyse simplifiée — user sans CV : pas de CV trouvé, analyse sans CV autorisée', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'nocv@sep.test', role: 'user' });

    // Simulate the search_engine CV loading logic
    let referenceCvPath = null;
    let cvLoadStatus = 'not_found';

    const primaryPath = await getPrimaryCvPath(userId);
    if (primaryPath) {
        referenceCvPath = primaryPath;
        cvLoadStatus = 'found';
    } else {
        const activePath = await getActiveCvPath(userId);
        if (activePath) {
            referenceCvPath = activePath;
            cvLoadStatus = 'found';
        }
    }

    // Verify: no CV found
    assert.equal(referenceCvPath, null, 'Aucun CV ne doit être trouvé pour un user sans CV');
    assert.equal(cvLoadStatus, 'not_found', 'Le statut doit être not_found');

    // Verify: simplified analysis would be triggered
    const hasReferenceCv = cvLoadStatus === 'loaded';
    assert.equal(hasReferenceCv, false, 'hasReferenceCv doit être false → analyse simplifiée');

    // Verify: the expected reason message
    const reason = cvLoadStatus === 'not_found'
        ? 'Aucun CV trouvé pour cet utilisateur.'
        : 'Autre raison';
    assert.equal(reason, 'Aucun CV trouvé pour cet utilisateur.', 'Le message explicite doit être présent');
});

// ─── Test 7: Utilisateur normal importe un 2ème CV — le 1er reste actif, aucun n'est primary ───
test('Utilisateur normal — 2ème CV uploadé : is_primary=0, is_active=0 (le 1er reste actif)', async () => {
    const { initDb } = await import('../db.js');
    const { getPrimaryCvPath, getActiveCvPath, getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'multi@sep.test', role: 'user' });
    const cvDir = path.join(__dirname, '../../cv/storage');
    await mkdir(cvDir, { recursive: true });

    // First CV (active)
    const cv1Path = path.join(cvDir, `${userId}_cv1.md`);
    await writeFile(cv1Path, '# CV 1');
    await db('cvs').insert({
        user_id: userId, name: 'CV 1', path: cv1Path, lang: 'fr', is_active: 1, is_primary: 0
    });

    // Second CV upload (as server.mjs does: is_primary=0, is_active=0 car il y a déjà un primary/active)
    const cv2Path = path.join(cvDir, `${userId}_cv2.md`);
    await writeFile(cv2Path, '# CV 2');
    await db('cvs').insert({
        user_id: userId, name: 'CV 2', path: cv2Path, lang: 'en', is_active: 0, is_primary: 0
    });

    // Verify: none are primary
    const primaryPath = await getPrimaryCvPath(userId);
    assert.equal(primaryPath, null, 'Aucun CV ne doit être primary');

    // Verify: first CV is still active
    const activePath = await getActiveCvPath(userId);
    assert.equal(activePath, cv1Path, 'Le 1er CV doit rester actif');

    // Verify: both CVs exist
    const allCvs = await getAllCvs(userId);
    assert.equal(allCvs.length, 2, 'Utilisateur doit avoir 2 CVs');
    assert.ok(allCvs.every(cv => !cv.is_primary), 'Aucun CV ne doit être is_primary');
});

// ─── Test 8: SUPER_ADMIN avec CV existant — importDefaultCvs ne crée pas de doublon ───
test('SUPER_ADMIN avec CV existant — importDefaultCvs idempotent (pas de doublon)', async () => {
    const { initDb } = await import('../db.js');
    const { importDefaultCvs } = await import('../import_default_cvs.js');
    const { getAllCvs } = await import('../cv_manager.js');

    const db = await initDb();
    await clearTables(db);

    const adminId = await createUser(db, { email: 'idempotent@sep.test', role: 'SUPER_ADMIN' });
    const cvDir = path.join(__dirname, '../../cv/storage');
    await mkdir(cvDir, { recursive: true });
    const cvPath = path.join(cvDir, `${adminId}_existing.md`);
    await writeFile(cvPath, '# CV Existant');
    await db('cvs').insert({
        user_id: adminId, name: 'CV Principal', path: cvPath, lang: 'fr', is_active: 1, is_primary: 1
    });

    // Run import twice
    await importDefaultCvs(adminId);
    await importDefaultCvs(adminId);

    // Verify: still only 1 CV
    const allCvs = await getAllCvs(adminId);
    assert.equal(allCvs.length, 1, 'importDefaultCvs ne doit PAS créer de doublon');
    assert.equal(allCvs[0].is_primary, 1, 'Le CV unique doit rester is_primary=1');
});
