import { browserScrape } from '../browser_scraper.js';

/**
 * Provider pour Indeed via scraping navigateur.
 * Note: Les sélecteurs Indeed varient souvent selon la région.
 */
export async function searchJobs(country, jobTitle, keywords) {
    console.log(`🔍 Recherche Indeed: ${jobTitle} (${keywords}) en ${country}...`);
    
    // Construction de l'URL Indeed (exemple pour la France/Allemagne)
    // On simplifie ici pour l'exemple, en utilisant un format standard.
    const countryMap = {
        "France": "fr",
        "Allemagne": "de",
        "Belgique": "be"
    };
    const cc = countryMap[country] || "fr";
    const query = encodeURIComponent(`${jobTitle} ${keywords}`);
    const url = `https://${cc}.indeed.com/jobs?q=${query}`;

    try {
        // Sélecteurs Indeed typiques (à adapter selon la version du site)
        const jobs = await browserScrape(
            url,
            '.job_seen_beacon', // Carte de l'offre
            'h2.jobTitle',      // Titre
            '.companyName',     // Entreprise
            'a'                 // Lien
        );

        return jobs.map(job => ({
            ...job,
            salary: "N/A", // Indeed nécessite souvent un clic pour le salaire
            contract_type: "Non spécifié",
            date_posted: new Date().toISOString().split('T')[0]
        }));
    } catch (err) {
        console.error("❌ Erreur Indeed Scraper:", err.message);
        return [];
    }
}
