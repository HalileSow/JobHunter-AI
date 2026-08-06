import { executeScheduledSearchRun } from './scheduled_search_service.js';

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

executeScheduledSearchRun({
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
}).catch((error) => {
    console.error(`❌ [ScheduledSearchRunner] Échec : ${error.message}`);
    process.exitCode = 1;
});

