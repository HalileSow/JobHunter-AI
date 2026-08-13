import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
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
    await db('backup_settings').del();
}

before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-analysis-'));
    process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');

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

// ─── Helper: simulate CV loading logic from search_engine.js ───
async function loadReferenceCv(db, userId) {
    const { getPrimaryCvPath, getActiveCvPath } = await import('../cv_manager.js');
    const fs = await import('node:fs/promises');

    let referenceCvPath = null;
    let referenceCvId = null;
    let cvLoadStatus = 'not_found';
    let cvLoadError = null;
    let cvContentLoaded = false;

    const primaryPath = await getPrimaryCvPath(userId);
    if (primaryPath) {
        cvLoadStatus = 'found';
        referenceCvPath = primaryPath;
    } else {
        const activePath = await getActiveCvPath(userId);
        if (activePath) {
            cvLoadStatus = 'found';
            referenceCvPath = activePath;
            const activeCv = await db('cvs').where({ user_id: userId, is_active: 1 }).first();
            if (activeCv) referenceCvId = activeCv.id;
        }
    }

    if (referenceCvPath) {
        try {
            const cvContent = await fs.readFile(referenceCvPath, 'utf-8');
            if (!cvContent || cvContent.trim().length === 0) {
                cvLoadStatus = 'empty';
                referenceCvPath = null;
            } else {
                cvContentLoaded = true;
                cvLoadStatus = 'loaded';
                if (!referenceCvId) {
                    const primaryCv = await db('cvs').where({ user_id: userId, is_primary: 1 }).first();
                    if (primaryCv) referenceCvId = primaryCv.id;
                }
            }
        } catch (readErr) {
            cvLoadError = readErr.message;
            referenceCvPath = null;
        }
    }

    const hasReferenceCv = cvLoadStatus === 'loaded';
    return { hasReferenceCv, cvLoadStatus, cvContentLoaded, referenceCvPath, referenceCvId, cvLoadError };
}

// ─── Helper: simulate analysis decision (mimics search_engine logic) ───
function decideAnalysis(cvResult, quotaReached, MAX_AI_ANALYSIS = 15) {
    if (!cvResult.hasReferenceCv) {
        const reason = cvResult.cvLoadStatus === 'not_found'
            ? 'Aucun CV trouvé pour cet utilisateur.'
            : cvResult.cvLoadStatus === 'empty'
            ? 'CV trouvé mais vide.'
            : `Erreur lecture CV : ${cvResult.cvLoadError}`;
        return {
            mode: 'simplified_no_cv',
            score: 50,
            analysis: `Analyse simplifiée sans CV de référence. ${reason}`
        };
    } else if (quotaReached) {
        return {
            mode: 'quota_reached_with_cv',
            score: 50,
            analysis: `Quota d'analyses IA atteint (${MAX_AI_ANALYSIS} analysées). Le CV de référence a été utilisé pour les offres précédentes. Prochaine analyse complète à la prochaine exécution.`
        };
    } else {
        return {
            mode: 'full_analysis_with_cv',
            wouldCallAI: true,
            cvPath: cvResult.referenceCvPath
        };
    }
}

// ═══════════════════════════════════════════════════════════
// Test 1: SUPER_ADMIN + CV principal → analyse AVEC CV
// ═══════════════════════════════════════════════════════════
test('SUPER_ADMIN avec CV principal → analyse complète AVEC CV (pas de message "sans CV")', async () => {
    const { initDb } = await import('../db.js');
    const db = await initDb();
    await clearTables(db);

    const adminId = await createUser(db, { email: 'superadmin@analysis.test', role: 'SUPER_ADMIN' });
    const cvDir = path.join(directory, 'cv_storage');
    await mkdir(cvDir, { recursive: true });

    const cvPath = path.join(cvDir, 'admin_primary.md');
    await writeFile(cvPath, '# CV Super Admin\n\n10 ans d\'expérience en développement Node.js, Python, React.\nCompétences: AWS, Docker, Kubernetes.');

    await db('cvs').insert({
        user_id: adminId,
        name: 'CV Principal',
        path: cvPath,
        lang: 'fr',
        is_primary: 1,
        is_active: 1
    });

    const cvResult = await loadReferenceCv(db, adminId);

    // CV must be found and loaded
    assert.equal(cvResult.hasReferenceCv, true, 'SUPER_ADMIN doit avoir un CV chargé');
    assert.equal(cvResult.cvLoadStatus, 'loaded', 'cvLoadStatus doit être loaded');
    assert.equal(cvResult.cvContentLoaded, true, 'cvContentLoaded doit être true');
    assert.equal(cvResult.referenceCvPath, cvPath, 'referenceCvPath doit pointer vers le CV principal');
    assert.ok(cvResult.referenceCvId, 'referenceCvId doit être renseigné');

    // Analysis decision: full analysis with CV
    const decision = decideAnalysis(cvResult, false);
    assert.equal(decision.mode, 'full_analysis_with_cv', 'Doit déclencher une analyse complète avec CV');
    assert.equal(decision.wouldCallAI, true, 'Doit appeler l\'IA');
    assert.equal(decision.cvPath, cvPath, 'Doit utiliser le CV principal');

    // Verify the analysis message does NOT contain "sans CV"
    assert.ok(!decision.analysis?.includes('sans CV de référence'), 'Le message ne doit PAS contenir "sans CV de référence"');
});

test('CV principal persistant en PostgreSQL → lecture sans dépendre du fichier du conteneur', async () => {
    const { getPrimaryCv, readCvContent } = await import('../cv_manager.js');
    const adminId = await createUser(sharedDb, { email: 'superadmin-persisted@analysis.test', role: 'SUPER_ADMIN' });
    const persistedContent = '# CV principal persistant\n\nCompétence distinctive: PostgreSQL et architecture multi-tenant.';

    await sharedDb('cvs').insert({
        user_id: adminId,
        name: 'CV Principal',
        path: '/app/cv/storage/1_cv_fr.md',
        content: persistedContent,
        mime_type: 'text/markdown',
        size_bytes: Buffer.byteLength(persistedContent),
        is_active: 1,
        is_primary: 1,
        lang: 'fr'
    });

    const primary = await getPrimaryCv(adminId);
    assert.equal(primary.user_id, adminId);
    assert.equal(await readCvContent(primary), persistedContent);
});

// ═══════════════════════════════════════════════════════════
// Test 2: Utilisateur normal + CV → analyse AVEC CV
// ═══════════════════════════════════════════════════════════
test('Utilisateur normal avec CV actif → analyse complète AVEC CV', async () => {
    const { initDb } = await import('../db.js');
    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'normal@analysis.test', role: 'user' });
    const cvDir = path.join(directory, 'cv_storage2');
    await mkdir(cvDir, { recursive: true });

    const cvPath = path.join(cvDir, 'user_active.md');
    await writeFile(cvPath, '# CV Utilisateur\n\n5 ans d\'expérience en marketing digital.');

    await db('cvs').insert({
        user_id: userId,
        name: 'Mon CV',
        path: cvPath,
        lang: 'fr',
        is_primary: 0,
        is_active: 1
    });

    const cvResult = await loadReferenceCv(db, userId);

    assert.equal(cvResult.hasReferenceCv, true, 'User normal doit avoir un CV chargé');
    assert.equal(cvResult.cvLoadStatus, 'loaded', 'cvLoadStatus doit être loaded');

    const decision = decideAnalysis(cvResult, false);
    assert.equal(decision.mode, 'full_analysis_with_cv', 'Doit déclencher une analyse complète avec CV');
    assert.equal(decision.cvPath, cvPath, 'Doit utiliser le CV actif');
});

// ═══════════════════════════════════════════════════════════
// Test 3: Utilisateur sans CV → analyse simplifiée avec message "Aucun CV"
// ═══════════════════════════════════════════════════════════
test('Utilisateur sans CV → analyse simplifiée avec message "Aucun CV"', async () => {
    const { initDb } = await import('../db.js');
    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'nocv@analysis.test', role: 'user' });

    const cvResult = await loadReferenceCv(db, userId);

    assert.equal(cvResult.hasReferenceCv, false, 'User sans CV → hasReferenceCv=false');
    assert.equal(cvResult.cvLoadStatus, 'not_found', 'cvLoadStatus doit être not_found');

    const decision = decideAnalysis(cvResult, false);
    assert.equal(decision.mode, 'simplified_no_cv', 'Doit déclencher une analyse simplifiée');
    assert.ok(decision.analysis.includes('Aucun CV trouvé'), 'Le message doit contenir "Aucun CV trouvé"');
    assert.ok(!decision.analysis.includes('Quota'), 'Le message ne doit PAS mentionner le quota');
});

// ═══════════════════════════════════════════════════════════
// Test 4: SUPER_ADMIN avec CV mais quota atteint → message quota (PAS "sans CV")
// ═══════════════════════════════════════════════════════════
test('SUPER_ADMIN avec CV + quota atteint → message de quota, PAS "sans CV"', async () => {
    const { initDb } = await import('../db.js');
    const db = await initDb();
    await clearTables(db);

    const adminId = await createUser(db, { email: 'superadmin-quota@analysis.test', role: 'SUPER_ADMIN' });
    const cvDir = path.join(directory, 'cv_storage3');
    await mkdir(cvDir, { recursive: true });

    const cvPath = path.join(cvDir, 'admin_primary_quota.md');
    await writeFile(cvPath, '# CV Super Admin\n\nExpérience test');

    await db('cvs').insert({
        user_id: adminId,
        name: 'CV Principal',
        path: cvPath,
        lang: 'fr',
        is_primary: 1,
        is_active: 1
    });

    const cvResult = await loadReferenceCv(db, adminId);
    assert.equal(cvResult.hasReferenceCv, true, 'SUPER_ADMIN doit avoir un CV chargé');

    // Simulate quota reached
    const decision = decideAnalysis(cvResult, true);
    assert.equal(decision.mode, 'quota_reached_with_cv', 'Doit être quota_reached_with_cv');
    assert.ok(decision.analysis.includes('Quota'), 'Le message doit mentionner le quota');
    assert.ok(decision.analysis.includes('CV de référence'), 'Le message doit confirmer que le CV a été pris en compte');
    assert.ok(!decision.analysis.includes('sans CV de référence'), 'Le message ne doit PAS dire "sans CV de référence"');
});

// ═══════════════════════════════════════════════════════════
// Test 5: Distinction claire entre "pas de CV" et "IA indisponible/quota"
// ═══════════════════════════════════════════════════════════
test('Les erreurs "pas de CV" et "quota IA" produisent des messages distincts', async () => {
    const { initDb } = await import('../db.js');
    const db = await initDb();
    await clearTables(db);

    // User A: no CV
    const userNoCv = await createUser(db, { email: 'nocv@dist.test', role: 'user' });
    // User B: has CV, quota reached
    const userWithQuota = await createUser(db, { email: 'quota@dist.test', role: 'user' });
    const cvDir = path.join(directory, 'cv_storage4');
    await mkdir(cvDir, { recursive: true });
    const cvPath = path.join(cvDir, 'quota_user.md');
    await writeFile(cvPath, '# CV Quota User');
    await db('cvs').insert({
        user_id: userWithQuota,
        name: 'CV',
        path: cvPath,
        lang: 'fr',
        is_primary: 0,
        is_active: 1
    });

    const cvResultA = await loadReferenceCv(db, userNoCv);
    const cvResultB = await loadReferenceCv(db, userWithQuota);

    const decisionA = decideAnalysis(cvResultA, false);
    const decisionB = decideAnalysis(cvResultB, true);

    // Messages must be different
    assert.notEqual(decisionA.mode, decisionB.mode, 'Les modes d\'analyse doivent être différents');

    // User A message: about missing CV
    assert.ok(decisionA.analysis.includes('Aucun CV'), 'User A: message = pas de CV');
    assert.ok(!decisionA.analysis.includes('Quota'), 'User A: ne doit PAS mentionner le quota');

    // User B message: about quota
    assert.ok(decisionB.analysis.includes('Quota'), 'User B: message = quota atteint');
    assert.ok(decisionB.analysis.includes('CV de référence'), 'User B: confirme que le CV existe');
    assert.ok(!decisionB.analysis.includes('Aucun CV'), 'User B: ne doit PAS dire "aucun CV"');

    // The two messages must not be identical
    assert.notEqual(decisionA.analysis, decisionB.analysis, 'Les messages doivent être totalement différents');
});

// ═══════════════════════════════════════════════════════════
// Test 6: CV vide → analyse simplifiée avec message "CV vide"
// ═══════════════════════════════════════════════════════════
test('CV vide → analyse simplifiée avec message "CV vide"', async () => {
    const { initDb } = await import('../db.js');
    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'emptycv@analysis.test', role: 'user' });
    const cvDir = path.join(directory, 'cv_storage5');
    await mkdir(cvDir, { recursive: true });

    const cvPath = path.join(cvDir, 'empty.md');
    await writeFile(cvPath, '   '); // Only whitespace

    await db('cvs').insert({
        user_id: userId,
        name: 'CV Vide',
        path: cvPath,
        lang: 'fr',
        is_primary: 0,
        is_active: 1
    });

    const cvResult = await loadReferenceCv(db, userId);

    assert.equal(cvResult.hasReferenceCv, false, 'CV vide → hasReferenceCv=false');
    assert.equal(cvResult.cvLoadStatus, 'empty', 'cvLoadStatus doit être empty');

    const decision = decideAnalysis(cvResult, false);
    assert.equal(decision.mode, 'simplified_no_cv', 'Doit déclencher une analyse simplifiée');
    assert.ok(decision.analysis.includes('CV trouvé mais vide'), 'Le message doit mentionner "CV vide"');
});

// ═══════════════════════════════════════════════════════════
// Test 7: CV avec path invalide (fichier supprimé) → erreur lecture
// ═══════════════════════════════════════════════════════════
test('CV avec fichier supprimé → erreur lecture, analyse simplifiée', async () => {
    const { initDb } = await import('../db.js');
    const db = await initDb();
    await clearTables(db);

    const userId = await createUser(db, { email: 'deletedcv@analysis.test', role: 'user' });

    // Insert CV with a path that doesn't exist
    const fakePath = path.join(directory, 'nonexistent', 'cv.md');
    await db('cvs').insert({
        user_id: userId,
        name: 'CV Supprimé',
        path: fakePath,
        lang: 'fr',
        is_primary: 0,
        is_active: 1
    });

    const cvResult = await loadReferenceCv(db, userId);

    assert.equal(cvResult.hasReferenceCv, false, 'Fichier inexistant → hasReferenceCv=false');
    assert.ok(cvResult.cvLoadError, 'cvLoadError doit être renseigné');

    const decision = decideAnalysis(cvResult, false);
    assert.equal(decision.mode, 'simplified_no_cv', 'Doit déclencher une analyse simplifiée');
    assert.ok(decision.analysis.includes('Erreur lecture CV'), 'Le message doit mentionner l\'erreur de lecture');
});
