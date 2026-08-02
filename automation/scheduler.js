import { initDb } from './db.js';
import { backupDatabase } from './backup_db.js';
import { launchSearchRun } from './search_run_launcher.js';

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
function computeNextRun(expression) {
    const now = new Date();
    // On scanne les 1440 prochaines minutes (24h)
    for (let i = 1; i <= 1440; i++) {
        const candidate = new Date(now.getTime() + i * 60000);
        candidate.setSeconds(0, 0);
        if (matchesCron(expression, candidate)) return candidate;
    }
    return null;
}

/**
 * Vérifie les recherches planifiées et lance celles qui correspondent à l'heure actuelle.
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
            status: 'queued'
        }).returning('id');
        const runId = inserted?.id || inserted;
        await launchSearchRun({
            runId,
            country: schedule.country,
            title: schedule.title,
            keywords: schedule.keywords || '',
            lang: schedule.lang || 'fr',
            advancedFilters,
            selectedProviderIds: parseProviderSelection(schedule.providers_list)
        });

        const nextRun = computeNextRun(schedule.cron_expression);

        await db('scheduled_searches').where({ id: schedule.id }).update({
            last_run_at: db.fn.now(),
            next_run_at: nextRun ? nextRun.toISOString() : null,
            total_runs: schedule.total_runs + 1
        });

    }
}

/**
 * Démarre le planificateur intégré. Vérifie chaque minute.
 */
let schedulerInterval = null;

export function startScheduler() {
    if (schedulerInterval) return;
    console.log('🕐 [Scheduler] Planificateur de recherches automatiques démarré (vérification chaque minute).');
    schedulerInterval = setInterval(() => {
        tick().catch((err) => console.error(`❌ [Scheduler] Erreur : ${err.message}`));
    }, 60_000);

    // Sauvegarde automatique toutes les 12h
    setInterval(() => {
        backupDatabase().then((res) => {
            console.log(`💾 [Scheduler] Sauvegarde auto : ${res.backupFileName}`);
        }).catch((err) => {
            console.error(`❌ [Scheduler] Échec sauvegarde auto : ${err.message}`);
        });
    }, 12 * 60 * 60 * 1000);
}

export function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('🛑 [Scheduler] Planificateur arrêté.');
    }
}

export { matchesCron, computeNextRun, tick };
