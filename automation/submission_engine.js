import { initDb } from './db.js';
import { defaultRegistry } from './providers/registry.js';
import { getActiveCvPath, getCvById, getPrimaryCvPath, createOptimizedCvCopy } from './cv_manager.js';
import { buildApplicationDocuments } from './application_automation.js';
import { recordApplicationAttempt } from './application_attempts.js';

function resolveProvider(providerId) {
    return defaultRegistry.get(providerId)
        || defaultRegistry.get('generic_custom')
        || defaultRegistry.getAll().find((provider) => provider.enabled)
        || null;
}

function normalizeJobStatus(submitResult = {}, fallback = 'Échec') {
    if (submitResult.status === 'réussie' || submitResult.success === true) return 'Soumis';
    if (submitResult.status === 'en attente' || submitResult.needsConfirmation) return 'En attente de confirmation';
    if (submitResult.status === 'échouée' || submitResult.success === false) return fallback;
    return fallback;
}

async function resolveApplicationDocuments(job, profile, { lang = 'fr', outputDir = null } = {}) {
    let selectedCvPath = null;
    let selectedCv = null;

    // Priority 1: Use explicitly selected CV (if not primary, we'll still use it for this application)
    if (job.selected_cv_id) {
        selectedCv = await getCvById(job.user_id, job.selected_cv_id);
        selectedCvPath = selectedCv?.path || null;
    }

    // Priority 2: If user has a primary CV, create an optimized copy for this application
    if (!selectedCvPath) {
        const primaryCvPath = await getPrimaryCvPath(job.user_id);
        if (primaryCvPath) {
            try {
                const optimizedCopy = await createOptimizedCvCopy(job.user_id, job.id, lang || 'fr');
                selectedCvPath = optimizedCopy.path;
                // Update the job to reference the optimized copy
                const db = await initDb();
                await db('jobs').where({ id: job.id }).update({ selected_cv_id: optimizedCopy.id });
                selectedCv = { id: optimizedCopy.id, path: optimizedCopy.path, is_primary: 0 };
            } catch (err) {
                console.warn(`⚠️ Failed to create optimized CV copy for job #${job.id}: ${err.message}`);
                // Fallback to primary CV directly
                selectedCvPath = primaryCvPath;
            }
        }
    }

    // Priority 3: Fallback to active CV
    if (!selectedCvPath) {
        selectedCvPath = await getActiveCvPath(job.user_id);
    }

    // If no CV available, continue anyway (cover letter will be used)
    if (!selectedCvPath) {
        console.log(`⚠️ Aucun CV disponible pour l'offre #${job.id}. Préparation du dossier sans CV.`);
    }

    const docs = await buildApplicationDocuments({
        job,
        profile,
        selectedCvPath,
        letterText: job.letter || '',
        letterPath: job.pdf_path || null,
        lang,
        outputDir
    });

    return {
        ...docs,
        selectedCv
    };
}

/**
 * Gère le cycle de soumission d'une candidature pour une offre.
 * - Si l'auto-apply est disponible et autorisé : exécution automatique -> statut 'Soumis'
 * - Sinon : prépare l'ensemble du dossier (CV, lettre PDF, données de formulaire pré-remplies) -> statut 'En attente de confirmation'
 * 
 * @param {number} jobId - L'identifiant de l'offre en BDD
 * @returns {Promise<Object>} Statut du traitement
 */
export async function processJobSubmission(jobId, options = {}) {
    const db = await initDb();
    const job = await db('jobs').where({ id: jobId }).first();
    
    if (!job) {
        throw new Error(`Offre #${jobId} non trouvée.`);
    }

    const providerInstance = resolveProvider(job.provider);
    const profile = await db('profile').where({ user_id: job.user_id }).first() || {};

    try {
        const applicationDocs = await resolveApplicationDocuments(job, profile, {
            lang: options.lang || 'fr',
            outputDir: options.documentOutputDir || null
        });
        const canAutoApply = providerInstance
            && typeof providerInstance.supportsAutoApply === 'function'
            && providerInstance.supportsAutoApply(job)
            && job.auto_apply_supported === 1;

        if (canAutoApply) {
            console.log(`🚀 [SubmissionEngine] Tentative de dépôt automatique pour #${job.id} (${job.company}) via ${providerInstance.name}`);
            
            const submitResult = await providerInstance.submitApplication(
                job,
                profile,
                applicationDocs.tailoredCvPath,
                applicationDocs.letterText
            );
            const finalStatus = submitResult?.status || (submitResult?.success ? 'réussie' : 'échouée');
            const jobStatus = normalizeJobStatus(submitResult);

            await db('jobs').where({ id: jobId }).update({
                status: jobStatus,
                error: submitResult?.success ? null : (submitResult?.error || submitResult?.details || null)
            });

            await db('job_logs').insert({
                job_id: jobId,
                platform: providerInstance.name || job.provider,
                result: finalStatus,
                error: submitResult?.error || null
            });

            await recordApplicationAttempt({
                jobId,
                provider: providerInstance.id || job.provider,
                mode: 'auto',
                status: finalStatus,
                confirmationId: submitResult?.confirmationId || '',
                applicationUrl: submitResult?.applicationUrl || job.link || '',
                tailoredCvPath: applicationDocs.tailoredCvPath,
                letterPath: applicationDocs.letterPath || job.pdf_path || '',
                details: submitResult?.details || '',
                error: submitResult?.error || '',
                payload: submitResult
            });

            console.log(`✅ [SubmissionEngine] Candidature soumise automatiquement avec succès pour ${job.company}!`);
            return {
                success: Boolean(submitResult?.success),
                mode: 'auto',
                status: jobStatus,
                attempt: submitResult
            };

        } else {
            console.log(`📝 [SubmissionEngine] Auto-apply non autorisé/possible sur ${job.company}. Préparation du dossier d'attente...`);

            // Génération du pack de pré-remplissage
            const pack = await (providerInstance?.prepareApplicationPack
                ? providerInstance.prepareApplicationPack(job, profile, applicationDocs.tailoredCvPath, applicationDocs.letterText)
                : Promise.resolve({
                    providerId: providerInstance?.id || job.provider || 'unknown',
                    providerName: providerInstance?.name || job.provider || 'unknown',
                    applyUrl: job.link,
                    cvPath: applicationDocs.tailoredCvPath,
                    letterText: applicationDocs.letterText,
                    instructions: 'Candidature préparée manuellement.'
                }));

            await db('jobs').where({ id: jobId }).update({
                status: 'En attente de confirmation',
                prefilled_data: JSON.stringify(pack),
                error: null
            });

            await db('job_logs').insert({
                job_id: jobId,
                platform: providerInstance ? providerInstance.name : job.provider,
                result: 'Dossier prêt (En attente de confirmation)',
                error: null
            });

            await recordApplicationAttempt({
                jobId,
                provider: providerInstance?.id || job.provider || 'unknown',
                mode: 'prepared',
                status: 'en attente',
                applicationUrl: job.link || '',
                tailoredCvPath: applicationDocs.tailoredCvPath,
                letterPath: applicationDocs.letterPath || job.pdf_path || '',
                details: 'Dossier préparé pour confirmation utilisateur.',
                payload: pack
            });

            console.log(`📋 [SubmissionEngine] Candidature #${jobId} entièrement préparée. En attente de confirmation utilisateur.`);
            return { success: true, mode: 'prepared', status: 'En attente de confirmation', pack };
        }
    } catch (err) {
        console.error(`❌ [SubmissionEngine] Erreur pour #${jobId} (${job.company}):`, err.message);
        
        await db('jobs').where({ id: jobId }).update({
            status: 'Échec',
            error: err.message
        });

        await db('job_logs').insert({
            job_id: jobId,
            platform: providerInstance?.name || job.provider || 'Inconnu',
            result: 'Échec',
            error: err.message
        });

        const selectedCv = job.selected_cv_id ? await getCvById(job.user_id, job.selected_cv_id) : null;
        await recordApplicationAttempt({
            jobId,
            provider: providerInstance?.id || job.provider || 'unknown',
            mode: 'auto',
            status: 'échouée',
            applicationUrl: job.link || '',
            tailoredCvPath: '',
            letterPath: job.pdf_path || '',
            details: `Échec de traitement pour ${job.company}.`,
            error: err.message,
            payload: {
                jobId,
                selectedCvId: job.selected_cv_id || null,
                selectedCvPath: selectedCv?.path || null
            }
        });

        return { success: false, mode: 'error', error: err.message };
    }
}

/**
 * Valide et finalise une candidature en attente de confirmation après validation explicite par l'utilisateur.
 * 
 * @param {number} jobId - ID de l'offre
 * @param {Object} [overrideData] - Données optionnelles fournies par l'utilisateur
 */
export async function confirmUserSubmission(jobId, overrideData = null) {
    const db = await initDb();
    const job = await db('jobs').where({ id: jobId }).first();

    if (!job) {
        throw new Error(`Offre #${jobId} non trouvée.`);
    }

    console.log(`👍 [SubmissionEngine] Confirmation manuelle reçue pour l'offre #${jobId} chez ${job.company}`);

    await db('jobs').where({ id: jobId }).update({
        status: 'Soumis',
        error: null
    });

    await db('job_logs').insert({
        job_id: jobId,
        platform: job.provider || 'Formulaire web',
        result: 'Validé par l\'utilisateur',
        error: null
    });

    await recordApplicationAttempt({
        jobId,
        provider: job.provider || 'manual',
        mode: 'manual',
        status: 'réussie',
        applicationUrl: overrideData?.applicationUrl || job.link || '',
        details: 'Candidature validée par l\'utilisateur.',
        payload: overrideData || null
    });

    return { success: true, status: 'Soumis', message: 'Candidature marquée comme soumise par l\'utilisateur.' };
}

/**
 * Rétro-compatibilité pour l'ancien helper submitJob
 */
export async function submitJob(jobId) {
    return processJobSubmission(jobId);
}
