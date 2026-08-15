import { runFullJobHunterSearch } from './search_engine.js';
import { processJobSubmission } from './submission_engine.js';
import { initDb } from './db.js';

export async function runSearch(country, jobTitle, keywords = '', lang = 'fr', selectedProviders = [], advancedFilters = {}) {
    await initDb();
    console.log(`\n🚀 [JobHunter-AI Core] Démarrage du cycle de recherche & candidature`);
    console.log(`📌 Métier : ${jobTitle} | Mots-clés : ${keywords || 'Aucun'} | Pays : ${country} | Langue : ${lang}`);
    if (advancedFilters.city || advancedFilters.experienceLevel || advancedFilters.contractType || advancedFilters.remote || advancedFilters.jobType) {
        console.log(`📋 Filtres avancés : ville=${advancedFilters.city || '—'} | expérience=${advancedFilters.experienceLevel || '—'} | contrat=${advancedFilters.contractType || '—'} | remote=${advancedFilters.remote || '—'} | type=${advancedFilters.jobType || '—'}`);
    }

    // 1. Exécution du moteur d'agrégation multi-providers & IA
    const searchResult = await runFullJobHunterSearch({
        country,
        jobTitle,
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
        selectedProviderIds: selectedProviders,
        userId: advancedFilters.userId || null
    });

    console.log(`\n✅ Recherche terminée. ${searchResult.jobsFound} offres uniques analysées et classées par IA.\n`);

    // 2. Traitement des candidatures (Auto-apply ou Dossier prêt)
    for (const job of searchResult.jobs) {
        if (job.status === 'Enregistré') {
            console.log(`⚡ Traitement soumission pour #${job.id} : ${job.title} chez ${job.company} (Score IA : ${job.score}/100)`);
            await processJobSubmission(job.id);
        }
    }

    console.log(`\n🎉 Workflow terminé avec succès pour ${jobTitle} en ${country}!\n`);
    return searchResult;
}

const [,, country, title, keywords, lang, advancedFiltersJson] = process.argv;
if (country && title) {
    let advancedFilters = {};
    let selectedProviders = [];
    if (advancedFiltersJson) {
        try {
            const parsed = JSON.parse(advancedFiltersJson);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                advancedFilters = parsed;
                if (Array.isArray(parsed.selectedProviderIds)) {
                    selectedProviders = parsed.selectedProviderIds;
                }
            }
        } catch (e) {
            console.warn(`⚠️ Filtres avancés invalides (JSON), ignorés : ${e.message}`);
        }
    }
    runSearch(country, title, keywords || "", lang || 'fr', selectedProviders, advancedFilters).catch((error) => {
        console.error(`❌ Échec du workflow : ${error.message}`);
        process.exitCode = 1;
    });
} else {
    console.log("Usage: node main.js <Pays> <Métier> <Mots-clés> [lang: fr|en|de] [advancedFiltersJson]");
}
