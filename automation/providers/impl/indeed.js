import { BaseProvider } from '../base_provider.js';
import { browserScrape } from '../../browser_scraper.js';

export class IndeedProvider extends BaseProvider {
    constructor() {
        super({
            id: 'indeed',
            name: 'Indeed',
            type: 'job_board',
            countries: ['*'],
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', limit = 20 }) {
        console.log(`🔍 [IndeedProvider] Recherche: ${jobTitle} (${keywords}) en ${country}...`);
        
        const countryDomains = {
            'France': 'fr.indeed.com',
            'Allemagne': 'de.indeed.com',
            'Sénégal': 'sn.indeed.com',
            'Côte d\'Ivoire': 'ci.indeed.com',
            'Belgique': 'be.indeed.com',
            'Suisse': 'ch.indeed.com',
            'Canada': 'ca.indeed.com'
        };
        
        const domain = countryDomains[country] || 'www.indeed.com';
        const query = encodeURIComponent(`${jobTitle} ${keywords}`.trim());
        const loc = encodeURIComponent(country);
        const url = `https://${domain}/jobs?q=${query}&l=${loc}`;

        try {
            const scraped = await browserScrape(
                url,
                'div.job_seen_beacon, div.cardOutline',
                'h2.jobTitle, a.jcs-JobTitle',
                'span.companyName, [data-testid="company-name"]',
                'h2.jobTitle a, a.jcs-JobTitle'
            );

            return scraped.slice(0, limit).map(job => ({
                title: job.title,
                company: job.company || 'Entreprise non spécifiée',
                link: job.link.startsWith('http') ? job.link : `https://${domain}${job.link}`,
                location: country,
                salary: 'N/A',
                contract_type: 'Non spécifié',
                date_posted: new Date().toISOString().split('T')[0],
                provider: this.id,
                provider_name: this.name,
                description: `Offre Indeed (${domain}) pour ${job.title} chez ${job.company}.`
            }));
        } catch (err) {
            console.error(`❌ [IndeedProvider] Erreur : ${err.message}`);
            return [];
        }
    }

    supportsAutoApply(job) {
        return false;
    }
}
