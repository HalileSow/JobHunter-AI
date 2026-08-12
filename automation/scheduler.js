import { initDb, insertAndGetId } from './db.js';
import { backupDatabase } from './backup_db.js';
import { launchSearchRun } from './search_run_launcher.js';
import { runFullJobHunterSearch } from './search_engine.js';
import { processJobSubmission } from './submission_engine.js';
import { notifyUserJob } from './notifications.js';

function parseProviderSelection(rawValue) {
    if (Array.isArray(rawValue)) return rawValue;
    if (typeof rawValue !== 'string' || !rawValue.trim()) return [];

    try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Parse une expression cron simplifiée (5 champs : minute heure jour_mois mois jour_semaine).
 * Retourne true si "now" correspond à l'expression.
 */
function matchesCron(expression, now = new Date()) {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) return false;

    const values = [
        now.getMinutes(),
        now.getHours(),
        now.getDate(),
        now.getMonth() + 1,
        now.getDay()
    ];

    return fields.every((field, i) => matchesField(field, values[i]));
}

function matchesField(field, value) {
    // Wildcard
    if (field === '*') return true;

    // Interval: */N
    const stepMatch = field.match(/^\*\/(\d+)$/);
    if (stepMatch) return value % Number(stepMatch[1]) === 0;

    // List: 1,5,10
    if (field.includes(',')) {
        return field.split(',').map(Number).includes(value);
    }

    // Range: 1-5
    if (field.includes('-')) {
        const [lo, hi] = field.split('-').map(Number);
        return value >= lo && value <= hi;
    }

    // Exact
    return Number(field) === value;
}

/**
 * Calcule le prochain déclenchement approximatif basé sur l'expression cron.
 */
function computeNextRun(expression, now = new Date()) {
    // On scanne les 1440 prochaines minutes (24h)
    for (let i = 1; i <= 1440; i++) {
        const candidate = new Date(now.getTime() + i * 60000);
        candidate.setSeconds(0, 0);
        if (matchesCron(expression, candidate)) return candidate;
    }
    return null;
}

/**
 * Détermine si un schedule doit être exécuté maintenant.
 * Deux conditions (l'une ou l'autre suffit) :
 *   1. matchesCron() — la minute courante correspond à l'expression cron
 *   2. next_run_at dépassé — le prochain run prévu est dans le passé (catch-up)
 */
function shouldTriggerNow(schedule, now) {
    if (matchesCron(schedule.cron_expression, now)) return { trigger: true, reason: 'cron_match' };

    if (schedule.next_run_at) {
        const nextRun = new Date(schedule.next_run_at);
        if (nextRun <= now) return { trigger: true, reason: 'catch_up' };
    }

    return { trigger: false };
}

/**
 * Vérifie les recherches planifiées, lance la recherche complète,
 * puis traite automatiquement les candidatures pour les offres pertinentes.
 */
async function tick() {
    const db = await initDb();
    const now = new Date();

    const schedules = await db('scheduled_searches').where({ enabled: true });

    if (schedules.length === 0) {
        console.log(`🕐 [Scheduler] Tick — aucune recherche planifiée active.`);
        return;
    }

    console.log(`🕐 [Scheduler] Tick — ${schedules.length} recherche(s) planifiée(s) active(s) à ${now.toISOString()}`);

    for (const schedule of schedules) {
        const { trigger, reason } = shouldTriggerNow(schedule, now);
        if (!trigger) {
            console.log(`  ⏭️ [Scheduler] "${schedule.name}" — pas encore due (next_run_at=${schedule.next_run_at || 'NULL'}, cron=${schedule.cron_expression})`);
            continue;
        }

        const userId = schedule.user_id;
        if (!userId) {
            console.warn(`⚠️ [Scheduler] Recherche "${schedule.name}" ignorée : aucun user_id associé.`);
            continue;
        }

        // Éviter de relancer si déjà exécuté dans les 55 dernières secondes
        if (schedule.last_run_at) {
            const lastRun = new Date(schedule.last_run_at);
            if (now.getTime() - lastRun.getTime() < 55000) {
                console.log(`  ⏭️ [Scheduler] "${schedule.name}" — déjà exécutée il y a moins de 55s`);
                continue;
            }
        }

        console.log(`⏰ [Scheduler] Déclenchement (${reason}) : "${schedule.name}" (${schedule.title} en ${schedule.country}) pour user_id=${userId}`);

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

        const runId = await insertAndGetId('search_runs', {
            country: schedule.country,
            title: schedule.title,
            keywords: schedule.keywords || '',
            lang: schedule.lang || 'fr',
            status: 'running',
            user_id: userId
        });

        try {
            // 1. Exécution du pipeline complet de recherche et scoring
            const result = await runFullJobHunterSearch({
                country: schedule.country,
                jobTitle: schedule.title,
                keywords: schedule.keywords || '',
                ...advancedFilters,
                lang: schedule.lang || 'fr',
                selectedProviderIds: parseProviderSelection(schedule.providers_list),
                userId
            });

            // 2. Traitement automatique des soumissions pour les offres sauvegardées
            for (const job of result.jobs) {
                // Seulement pour les offres très pertinentes automatiquement
                if (job.score >= 85) {
                    console.log(`🚀 [Scheduler] Auto-soumission pour #${job.id} (Score: ${job.score})`);
                    await processJobSubmission(job.id);
                }
            }

            // 2b. Notifications webhook pour les nouvelles offres (non-bloquant)
            if (result.jobs?.length > 0) {
                await notifyUserJob({ db, userId, jobs: result.jobs }).catch((err) =>
                    console.warn(`⚠️ [Scheduler] Notifications webhooks: ${err.message}`)
                );
            }

            // 3. Mise à jour des métriques du run
            await db('search_runs').where({ id: runId }).update({
                status: 'completed',
                finished_at: db.fn.now(),
                raw_jobs_count: result.rawJobsFound || 0,
                unique_jobs_count: result.uniqueJobsFound || 0,
                analyzed_jobs_count: result.jobsAnalyzed || 0,
                saved_jobs_count: result.jobsSaved || 0,
                duplicate_jobs_count: result.duplicateJobsSkipped || 0
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

/**
 * Démarre le planificateur intégré. Vérifie chaque minute.
 * Protégé contre le chevauchement des ticks : si un tick est déjà en cours,
 * le suivant est ignoré plutôt que lancé en parallèle.
 * 
 * OPTIMISATION MÉMOIRE : Intervalle minimum de 5 minutes entre les recherches
 * pour éviter de saturer la mémoire avec des exécutions trop rapprochées.
 */
let schedulerInterval = null;
let tickInProgress = false;
let lastSearchRunTime = 0;

export async function startScheduler() {
    if (schedulerInterval) return;
    console.log('🕐 [Scheduler] Planificateur de recherches automatiques démarré (vérification chaque minute).');

    // Log de diagnostic au démarrage
    try {
        const db = await initDb();
        const schedules = await db('scheduled_searches').where({ enabled: true });
        console.log(`🕐 [Scheduler] ${schedules.length} recherche(s) planifiée(s) active(s) chargée(s) depuis la BDD.`);
        for (const s of schedules) {
            console.log(`🕐 [Scheduler]   → "${s.name}" (cron=${s.cron_expression}, next_run_at=${s.next_run_at || 'NULL'}, last_run_at=${s.last_run_at || 'never'}, user_id=${s.user_id || 'none'})`);
        }
    } catch (err) {
        console.warn(`⚠️ [Scheduler] Impossible de charger les schedules au démarrage : ${err.message}`);
    }

    // Exécution immédiate au démarrage (catch-up si des runs sont en retard)
    safeTick();

    // Puis vérification chaque minute
    schedulerInterval = setInterval(() => safeTick(), 60_000);

    // Sauvegarde automatique — intervalle lu depuis la BDD (défaut 12h)
    startBackupScheduler();
}

let backupSchedulerHandle = null;
let activeBackupPromise = null;
let activeTickPromise = null;

async function startBackupScheduler() {
    if (backupSchedulerHandle) {
        clearInterval(backupSchedulerHandle);
        backupSchedulerHandle = null;
    }

    // Render PostgreSQL is managed and must not be backed up as a local SQLite file.
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
        console.log('💾 [Scheduler] Sauvegarde locale désactivée : PostgreSQL Render est géré séparément.');
        return;
    }

    try {
        const db = await initDb();
        const settings = await db('backup_settings').first();
        const intervalHours = settings?.enabled ? (settings.interval_hours || 12) : 0;

        if (intervalHours <= 0) {
            console.log('💾 [Scheduler] Sauvegarde automatique désactivée (enabled=0).');
            return;
        }

        const intervalMs = intervalHours * 60 * 60 * 1000;
        console.log(`💾 [Scheduler] Sauvegarde automatique configurée toutes les ${intervalHours}h.`);

        // Backup immédiat au démarrage
        await runBackup(settings?.retention_max || 14);

        backupSchedulerHandle = setInterval(() => {
            // Re-read settings each time in case they changed
            runBackup();
        }, intervalMs);
    } catch (err) {
        // Fallback: if backup_settings table doesn't exist yet, use default
        console.log(`💾 [Scheduler] Sauvegarde auto (mode par défaut, 12h) — ${err.message}`);
        await runBackup(14);
        backupSchedulerHandle = setInterval(() => runBackup(14), 12 * 60 * 60 * 1000);
    }
}

async function runBackup(retentionMax) {
    activeBackupPromise = (async () => {
        try {
            const res = await backupDatabase(retentionMax ? { retentionMax } : {});
            console.log(`💾 [Scheduler] Sauvegarde auto : ${res.backupFileName}`);

            // Update settings table with last run info
            try {
                const db = await initDb();
                await db('backup_settings').update({
                    last_run_at: db.fn.now(),
                    last_backup_path: res.backupPath,
                    last_error: null,
                    updated_at: db.fn.now()
                });
            } catch {
                // ignore — settings table may not exist yet
            }
        } catch (err) {
            console.error(`❌ [Scheduler] Échec sauvegarde auto : ${err.message}`);

            try {
                const db = await initDb();
                await db('backup_settings').update({
                    last_error: err.message,
                    updated_at: db.fn.now()
                });
            } catch {
                // ignore
            }
        }
    })();
    await activeBackupPromise;
    activeBackupPromise = null;
}

function safeTick() {
    if (tickInProgress) {
        console.log('⏭️ [Scheduler] Tick précédent encore en cours, report du suivant.');
        return;
    }

    tickInProgress = true;
    activeTickPromise = tick().then(() => {
        lastSearchRunTime = Date.now();
    }).catch((err) => console.error(`❌ [Scheduler] Erreur tick : ${err.message}`))
        .finally(() => {
            tickInProgress = false;
            activeTickPromise = null;
        });
}

export async function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
    if (backupSchedulerHandle) {
        clearInterval(backupSchedulerHandle);
        backupSchedulerHandle = null;
    }
    if (activeBackupPromise) {
        await activeBackupPromise;
    }
    if (activeTickPromise) {
        await activeTickPromise;
    }
    console.log('🛑 [Scheduler] Planificateur arrêté.');
}

/**
 * Redémarre uniquement le scheduler de backup (appelle quand les settings changent).
 */
export async function restartBackupScheduler() {
    await startBackupScheduler();
}

export { matchesCron, computeNextRun, shouldTriggerNow, tick };
