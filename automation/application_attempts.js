import { initDb, insertAndGetId } from './db.js';

function normalizeAttemptStatus(status) {
    const value = String(status || '').toLowerCase().trim();

    if (!value) return 'en attente';
    if (['success', 'succeeded', 'réussie', 'reussie', 'soumis', 'submitted', 'done'].includes(value)) {
        return 'réussie';
    }
    if (['pending', 'en attente', 'attente', 'prepared', 'prepared_for_confirmation', 'needs_confirmation'].includes(value)) {
        return 'en attente';
    }
    if (['failed', 'failure', 'échouée', 'echouee', 'error', 'errored'].includes(value)) {
        return 'échouée';
    }

    return value;
}

function serializePayload(payload) {
    if (payload === undefined || payload === null) return null;

    try {
        return JSON.stringify(payload);
    } catch {
        return JSON.stringify({ value: String(payload) });
    }
}

export async function recordApplicationAttempt({
    jobId,
    provider,
    mode,
    status,
    confirmationId = '',
    applicationUrl = '',
    tailoredCvPath = '',
    letterPath = '',
    details = '',
    error = '',
    payload = null
}) {
    const db = await initDb();

    const insertedId = await insertAndGetId('application_attempts', {
        job_id: jobId,
        provider: provider || 'unknown',
        mode: mode || 'auto',
        status: normalizeAttemptStatus(status),
        confirmation_id: confirmationId || null,
        application_url: applicationUrl || null,
        tailored_cv_path: tailoredCvPath || null,
        letter_path: letterPath || null,
        details: details || null,
        error: error || null,
        payload_json: serializePayload(payload)
    });

    return insertedId;
}

export async function getApplicationAttempts(jobId, limit = 20) {
    const db = await initDb();
    return db('application_attempts')
        .where({ job_id: jobId })
        .orderBy('created_at', 'desc')
        .limit(limit);
}
