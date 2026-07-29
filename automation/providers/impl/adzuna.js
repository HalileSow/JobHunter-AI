import { BaseProvider } from '../base_provider.js';
import axios from 'axios';

export class AdzunaProvider extends BaseProvider {
    constructor() {
        super({
            id: 'adzuna',
            name: 'Adzuna API',
            type: 'official_api',
            countries: ['France', 'Allemagne', 'Autriche', 'Belgique', 'Luxembourg', 'Pays-Bas', 'Royaume-Uni', 'Royaume-Uni / UK', 'États-Unis', 'Canada'],
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', limit = 20 }) {
        console.log(`🔍 [AdzunaProvider] Recherche API: ${jobTitle} (${keywords}) en ${country}...`);

        const countryCodes = {
            "France": "fr", "Allemagne": "de", "Autriche": "at",
            "Belgique": "be", "Luxembourg": "lu", "Pays-Bas": "nl",
            "Royaume-Uni": "gb", "Canada": "ca", "États-Unis": "us"
        };
        const countryCode = countryCodes[country] || "fr";

        const appId = process.env.ADZUNA_APP_ID;
        const appKey = process.env.ADZUNA_APP_KEY;

        if (!appId || !appKey) {
            console.warn(`⚠️ [AdzunaProvider] Clés ADZUNA_APP_ID / ADZUNA_APP_KEY manquantes dans .env. Ignoré.`);
            return [];
        }

        try {
            const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=${limit}&what=${encodeURIComponent(jobTitle + " " + keywords)}`;
            const { data } = await axios.get(url, { timeout: 10000 });

            if (!data.results) return [];

            return data.results.map(job => ({
                title: job.title.replace(/<[^>]*>?/gm, ''),
                company: job.company?.display_name || 'Inconnue',
                link: job.redirect_url,
                location: job.location?.display_name || country,
                salary: job.salary_min ? `${Math.round(job.salary_min)} - ${Math.round(job.salary_max)}` : "Non spécifié",
                contract_type: job.contract_type || "Plein temps",
                date_posted: job.created ? job.created.split('T')[0] : new Date().toISOString().split('T')[0],
                provider: this.id,
                provider_name: this.name,
                description: job.description || ''
            }));
        } catch (err) {
            console.error(`❌ [AdzunaProvider] Erreur API Adzuna : ${err.message}`);
            return [];
        }
    }

    supportsAutoApply(job) {
        return false;
    }
}
