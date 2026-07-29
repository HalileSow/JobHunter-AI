import { initDb } from './db.js';
import { defaultRegistry } from './providers/registry.js';
import fs from 'fs/promises';

/**
 * Gère le cycle de soumission d'une candidature pour une offre.
 * - Si l'auto-apply est disponible et autorisé : exécution automatique -> statut 'Soumis'
 * - Sinon : prépare l'ensemble du dossier (CV, lettre PDF, données de formulaire pré-remplies) -> statut 'En attente de confirmation'
 * 
 * @param {number} jobId - L'identifiant de l'offre en BDD
 * @returns {Promise<Object>} Statut du traitement
 */
export async function processJobSubmission(jobId) {
    const db = await initDb();
    const job = await db('jobs').where({ id: jobId }).first();
    
    if (!job) {
        throw new Error(`Offre #${jobId} non trouvée.`);
    }

    const providerInstance = defaultRegistry.get(job.provider) || defaultRegistry.get('generic');
    const profile = await db('profile').where({ id: 1 }).first() || {};

    try {
        const canAutoApply = providerInstance && providerInstance.supportsAutoApply(job) && job.auto_apply_supported === 1;

        if (canAutoApply) {
            console.log(`🚀 [SubmissionEngine] Tentative de dépôt automatique pour #${job.id} (${job.company}) via ${providerInstance.name}`);
            
            const submitResult = await providerInstance.submitApplication(job, profile, job.pdf_path, job.letter);

            await db('jobs').where({ id: jobId }).update({
                status: 'Soumis',
                error: null
            });

            await db('job_logs').insert({
                job_id: jobId,
                platform: providerInstance.name || job.provider,
                result: 'Succès auto-apply',
                error: null
            });

            console.log(`✅ [SubmissionEngine] Candidature soumise automatiquement avec succès pour ${job.company}!`);
            return { success: true, mode: 'auto', status: 'Soumis' };

        } else {
            console.log(`📝 [SubmissionEngine] Auto-apply non autorisé/possible sur ${job.company}. Préparation du dossier d'attente...`);

            // Génération du pack de pré-remplissage
            const pack = await providerInstance.prepareApplicationPack(job, profile, job.pdf_path, job.letter);

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
            platform: job.provider || 'Inconnu',
            result: 'Échec',
            error: err.message
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

    return { success: true, status: 'Soumis', message: 'Candidature marquée comme soumise par l\'utilisateur.' };
}

/**
 * Rétro-compatibilité pour l'ancien helper submitJob
 */
export async function submitJob(jobId) {
    return processJobSubmission(jobId);
}
