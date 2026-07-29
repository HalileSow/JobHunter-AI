import { runFullJobHunterSearch } from './search_engine.js';
import { processJobSubmission } from './submission_engine.js';
import { defaultRegistry } from './providers/registry.js';
import { initDb } from './db.js';

export async function runSearch(country, jobTitle, keywords = '', lang = 'fr', selectedProviders = []) {
    await initDb();
    console.log(`\n🚀 [JobHunter-AI Core] Démarrage du cycle de recherche & candidature`);
    console.log(`📌 Métier : ${jobTitle} | Mots-clés : ${keywords || 'Aucun'} | Pays : ${country} | Langue : ${lang}\n`);

    // 1. Exécution du moteur d'agrégation multi-providers & IA
    const searchResult = await runFullJobHunterSearch({
        country,
        jobTitle,
        keywords,
        lang,
        selectedProviderIds: selectedProviders
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

const [,, country, title, keywords, lang] = process.argv;
if (country && title) {
    runSearch(country, title, keywords || "", lang || 'fr').catch((error) => {
        console.error(`❌ Échec du workflow : ${error.message}`);
        process.exitCode = 1;
    });
} else {
    console.log("Usage: node main.js <Pays> <Métier> <Mots-clés> [lang: fr|en|de]");
}
