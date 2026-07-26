import axios from 'axios';

// Adzuna API requires APP_ID and APP_KEY from .env
export async function searchJobs(country, jobTitle, keywords) {
    console.log(`🔍 Recherche Adzuna: ${jobTitle} (${keywords}) en ${country}...`);
    
    // Mappage pays Adzuna (ex: gb, de, fr...)
    const countryCodes = { "Allemagne": "de", "Autriche": "at", "Belgique": "be", "Luxembourg": "lu", "Pays-Bas": "nl", "Irlande": "ie" };
    const countryCode = countryCodes[country] || "de";

    try {
        // NOTE: Nécessite ADZUNA_APP_ID et ADZUNA_APP_KEY dans le .env
        const appId = process.env.ADZUNA_APP_ID;
        const appKey = process.env.ADZUNA_APP_KEY;
        
        if (!appId || !appKey) {
            console.warn("⚠️ API Adzuna non configurée (clés manquantes). Ce fournisseur est ignoré.");
            return [];
        }

        const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=10&what=${encodeURIComponent(jobTitle + " " + keywords)}`;
        const { data } = await axios.get(url);

        return data.results.map(job => ({
            title: job.title,
            company: job.company.display_name,
            link: job.redirect_url,
            salary: job.salary_min ? `${job.salary_min}-${job.salary_max}` : "N/A",
            contract_type: "Full-time", // Adzuna API n'est pas toujours explicite
            date_posted: job.created.split('T')[0],
            description: job.description || ''
        }));
    } catch (err) {
        console.error("❌ Erreur API Adzuna:", err.message);
        return [];
    }
}
