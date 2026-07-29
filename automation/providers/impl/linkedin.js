import { BaseProvider } from '../base_provider.js';
import { browserScrape } from '../../browser_scraper.js';

export class LinkedInProvider extends BaseProvider {
    constructor() {
        super({
            id: 'linkedin',
            name: 'LinkedIn',
            type: 'job_board',
            countries: ['*'],
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', limit = 20 }) {
        console.log(`🔍 [LinkedInProvider] Recherche: ${jobTitle} (${keywords}) en ${country}...`);
        
        const query = encodeURIComponent(`${jobTitle} ${keywords}`.trim());
        const loc = encodeURIComponent(country);
        const url = `https://www.linkedin.com/jobs/search?keywords=${query}&location=${loc}&f_TPR=r604800`;

        try {
            const scraped = await browserScrape(
                url,
                'div.base-card, .jobs-search__results-list > li',
                'h3.base-search-card__title, .base-search-card__title',
                'h4.base-search-card__subtitle, .base-search-card__subtitle',
                'a.base-card__full-link, .base-card__full-link'
            );

            return scraped.slice(0, limit).map(job => ({
                title: job.title,
                company: job.company,
                link: job.link,
                location: country,
                salary: 'N/A',
                contract_type: 'CDI / Non spécifié',
                date_posted: new Date().toISOString().split('T')[0],
                provider: this.id,
                provider_name: this.name,
                description: `Offre LinkedIn public pour ${job.title} chez ${job.company}.`
            }));
        } catch (err) {
            console.error(`❌ [LinkedInProvider] Erreur : ${err.message}`);
            return [];
        }
    }

    supportsAutoApply(job) {
        // Direct auto-apply on LinkedIn public page requires user credentials or Easy Apply session.
        // By default, flag as requiring user confirmation.
        return false;
    }
}
