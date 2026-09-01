import { executeScheduledSearchRun } from './scheduled_search_service.js';
import { closeBrowser } from './browser_pool.js';
import { destroyDb, initDb } from './db.js';

const [,, country, title, keywords, lang, payloadJson] = process.argv;

if (!country || !title) {
    console.log('Usage: node scheduled_search_runner.js <Pays> <Métier> <Mots-clés> [lang: fr|en|de] [payloadJson]');
    process.exit(1);
}

let payload = {};
if (payloadJson) {
    try {
        payload = JSON.parse(payloadJson);
    } catch (error) {
        console.warn(`⚠️ [ScheduledSearchRunner] Payload JSON invalide, ignoré : ${error.message}`);
    }
}

// Porté à 15 min car 8 providers séquentiels avec Chromium
// peuvent prendre 10-12 min (LinkedIn, Indeed, Career Pages
// nécessitent chacun le lancement de Chromium).
const SEARCH_RUN_TIMEOUT_MS = Number(process.env.SEARCH_RUN_TIMEOUT_MS || 15 * 60 * 1000);

async function main() {
    let timeoutHandle;
    const searchPromise = executeScheduledSearchRun({
        runId: payload.runId,
        scheduleId: payload.scheduleId || null,
        nextRunAt: payload.nextRunAt || null,
        country,
        title,
        keywords: keywords || '',
        lang: lang || 'fr',
        userId: payload.userId || null,
        advancedFilters: payload.advancedFilters || {},
        selectedProviderIds: payload.selectedProviderIds || []
    });

    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(`Recherche interrompue après ${Math.round(SEARCH_RUN_TIMEOUT_MS / 60000)} minutes.`));
        }, SEARCH_RUN_TIMEOUT_MS);
    });

    try {
        await Promise.race([searchPromise, timeoutPromise]);
    } catch (error) {
        console.error(`❌ [ScheduledSearchRunner] Échec : ${error.message}`);
        // Le service gère déjà ses erreurs internes. Le timeout arrive autour
        // du service, donc il faut marquer explicitement le run comme échoué.
        if (payload.runId) {
            try {
                const db = await initDb();
                await db('search_runs').where({ id: payload.runId }).update({
                    status: 'failed',
                    error: error.message,
                    finished_at: db.fn.now()
                });
            } catch (updateError) {
                console.error(`❌ [ScheduledSearchRunner] Impossible de clôturer le run : ${updateError.message}`);
            }
        }
        process.exitCode = 1;
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        await closeBrowser().catch((error) => console.warn(`⚠️ Fermeture browser : ${error.message}`));
        await destroyDb().catch((error) => console.warn(`⚠️ Fermeture DB : ${error.message}`));
    }
}

main().then(() => {
    process.exit(process.exitCode || 0);
});
