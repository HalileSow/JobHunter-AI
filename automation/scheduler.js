import { initDb } from './db.js';
import { backupDatabase } from './backup_db.js';
import { launchSearchRun } from './search_run_launcher.js';
import { runFullJobHunterSearch } from './search_engine.js';
import { processJobSubmission } from './submission_engine.js';

// ... (fonctions parseProviderSelection, matchesCron, matchesField, computeNextRun restent inchangées)

/**
 * Vérifie les recherches planifiées, lance la recherche complète,
 * puis traite automatiquement les candidatures pour les offres pertinentes.
 */
async function tick() {
    const db = await initDb();
    const now = new Date();

    const schedules = await db('scheduled_searches').where({ enabled: true });

    for (const schedule of schedules) {
        if (!matchesCron(schedule.cron_expression, now)) continue;

        // Éviter de relancer si déjà exécuté dans la même minute
        if (schedule.last_run_at) {
            const lastRun = new Date(schedule.last_run_at);
            if (now.getTime() - lastRun.getTime() < 55000) continue;
        }

        console.log(`⏰ [Scheduler] Déclenchement planifié : "${schedule.name}" (${schedule.title} en ${schedule.country})`);

        const advancedFilters = {
            city: schedule.city || '',
            experienceLevel: schedule.experience_level || '',
            contractType: schedule.contract_type || '',
            remote: schedule.remote || '',
            jobType: schedule.job_type || '',
            salary: schedule.salary || '',
            minSalary: schedule.min_salary || '',
            maxSalary: schedule.max_salary || ''
        };

        const [inserted] = await db('search_runs').insert({
            country: schedule.country,
            title: schedule.title,
            keywords: schedule.keywords || '',
            lang: schedule.lang || 'fr',
            status: 'running'
        }).returning('id');
        const runId = inserted?.id || inserted;

        try {
            // 1. Exécution du pipeline complet de recherche et scoring
            const result = await runFullJobHunterSearch({
                country: schedule.country,
                jobTitle: schedule.title,
                keywords: schedule.keywords || '',
                ...advancedFilters,
                lang: schedule.lang || 'fr',
                selectedProviderIds: parseProviderSelection(schedule.providers_list)
            });

            // 2. Traitement automatique des soumissions pour les offres sauvegardées
            for (const job of result.jobs) {
                // Seulement pour les offres très pertinentes automatiquement
                if (job.score >= 85) {
                    console.log(`🚀 [Scheduler] Auto-soumission pour #${job.id} (Score: ${job.score})`);
                    await processJobSubmission(job.id);
                }
            }

            // 3. Mise à jour des métriques du run
            await db('search_runs').where({ id: runId }).update({
                status: 'completed',
                finished_at: db.fn.now(),
                raw_jobs_count: result.rawJobsFound || 0,
                unique_jobs_count: result.uniqueJobsFound || 0,
                saved_jobs_count: result.jobsSaved || 0
            });

            // 4. Mise à jour du schedule
            const nextRun = computeNextRun(schedule.cron_expression);
            await db('scheduled_searches').where({ id: schedule.id }).update({
                last_run_at: db.fn.now(),
                next_run_at: nextRun ? nextRun.toISOString() : null,
                total_runs: db.raw('total_runs + 1'),
                last_status: 'success'
            });

        } catch (error) {
            console.error(`❌ [Scheduler] Erreur critique lors du run ${runId} : ${error.message}`);
            await db('search_runs').where({ id: runId }).update({
                status: 'failed',
                error: error.message,
                finished_at: db.fn.now()
            });
            await db('scheduled_searches').where({ id: schedule.id }).update({
                last_status: 'error',
                last_error: error.message
            });
        }
    }
}
// ... (startScheduler, stopScheduler, restent inchangés)
