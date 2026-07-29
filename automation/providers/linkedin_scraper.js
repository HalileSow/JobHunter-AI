import { browserScrape } from '../browser_scraper.js';

/**
 * Provider pour LinkedIn via scraping public.
 */
export async function searchJobs(country, jobTitle, keywords) {
    console.log(`🔍 Recherche LinkedIn: ${jobTitle} (${keywords}) en ${country}...`);
    
    const query = encodeURIComponent(`${jobTitle} ${keywords}`);
    const loc = encodeURIComponent(country);
    // LinkedIn public jobs search page
    const url = `https://www.linkedin.com/jobs/search?keywords=${query}&location=${loc}&f_TPR=r604800`; // f_TPR=r604800 for past week

    try {
        const jobs = await browserScrape(
            url,
            'div.base-card, .jobs-search__results-list > li', // Carte de l'offre
            'h3.base-search-card__title, .base-search-card__title', // Titre
            'h4.base-search-card__subtitle, .base-search-card__subtitle', // Entreprise
            'a.base-card__full-link, .base-card__full-link' // Lien
        );

        return jobs.map(job => ({
            ...job,
            salary: "N/A",
            contract_type: "Non spécifié",
            date_posted: new Date().toISOString().split('T')[0]
        }));
    } catch (err) {
        console.error("❌ Erreur LinkedIn Scraper:", err.message);
        return [];
    }
}
