import { defaultRegistry } from './providers/registry.js';
import { initDb } from './db.js';
import { runFullJobHunterSearch } from './search_engine.js';

function resolveProviderIds(selectedProviderIds = []) {
    if (Array.isArray(selectedProviderIds) && selectedProviderIds.length > 0) {
        return selectedProviderIds
            .map((providerId) => String(providerId))
            .filter((providerId) => defaultRegistry.get(providerId)?.enabled);
    }

    return defaultRegistry.getEnabled().map((provider) => provider.id);
}

async function updateSearchRun(db, runId, updates) {
    if (!runId) return;
    await db('search_runs').where({ id: runId }).update(updates);
}

async function updateScheduledSearch(db, scheduleId, updates) {
    if (!scheduleId) return;
    await db('scheduled_searches').where({ id: scheduleId }).update(updates);
}

export async function executeScheduledSearchRun({
    runId,
    scheduleId = null,
    nextRunAt = null,
    country,
    title,
    userId,
    keywords = '',
    lang = 'fr',
    advancedFilters = {},
    selectedProviderIds = []
}) {
    const db = await initDb();
    const providerIds = resolveProviderIds(selectedProviderIds);

    await updateSearchRun(db, runId, {
        status: 'running',
        started_at: db.fn.now(),
        error: null
    });

    try {
        const result = await runFullJobHunterSearch({
            country,
            jobTitle: title,
            keywords,
            city: advancedFilters.city || '',
            experienceLevel: advancedFilters.experienceLevel || '',
            contractType: advancedFilters.contractType || '',
            remote: advancedFilters.remote || '',
            jobType: advancedFilters.jobType || '',
            salary: advancedFilters.salary || '',
            minSalary: advancedFilters.minSalary || '',
            maxSalary: advancedFilters.maxSalary || '',
            lang,
            selectedProviderIds: providerIds,
            userId
        });

        const completedUpdates = {
            status: 'completed',
            error: null,
            finished_at: db.fn.now(),
            raw_jobs_count: result.rawJobsFound || 0,
            unique_jobs_count: result.uniqueJobsFound || result.jobsFound || 0,
            analyzed_jobs_count: result.jobsAnalyzed || 0,
            saved_jobs_count: result.jobsSaved || 0,
            duplicate_jobs_count: result.duplicateJobsSkipped || 0
        };

        await updateSearchRun(db, runId, completedUpdates);

        await updateScheduledSearch(db, scheduleId, {
            last_run_at: db.fn.now(),
            next_run_at: nextRunAt || null,
            total_runs: db.raw('total_runs + 1'),
            last_status: 'success',
            last_error: null,
            last_raw_jobs_count: result.rawJobsFound || 0,
            last_unique_jobs_count: result.uniqueJobsFound || result.jobsFound || 0,
            last_analyzed_jobs_count: result.jobsAnalyzed || 0,
            last_new_jobs_count: result.jobsSaved || 0,
            last_duplicate_jobs_count: result.duplicateJobsSkipped || 0
        });

        return {
            success: true,
            ...result
        };
    } catch (error) {
        const message = error?.message || 'Erreur inconnue';

        await updateSearchRun(db, runId, {
            status: 'failed',
            error: message,
            finished_at: db.fn.now()
        });

        await updateScheduledSearch(db, scheduleId, {
            last_run_at: db.fn.now(),
            next_run_at: nextRunAt || null,
            total_runs: db.raw('total_runs + 1'),
            last_status: 'error',
            last_error: message
        });

        throw error;
    }
}

