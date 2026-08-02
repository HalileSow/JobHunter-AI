import { BaseProvider } from '../base_provider.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { browserScrape } from '../../browser_scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeCountry(value = '') {
    return String(value).toLowerCase().trim();
}

function buildJobUrl(urlPattern, query) {
    return urlPattern.replace('{query}', encodeURIComponent(query));
}

export class GenericCustomProvider extends BaseProvider {
    constructor() {
        super({
            id: 'generic_custom',
            name: 'Custom Career Pages (Config)',
            type: 'custom_scraper',
            countries: ['*'],
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', city = '', experienceLevel = '', contractType = '', remote = '', jobType = '', limit = 20 }) {
        console.log(`🔎 [GenericCustomProvider] Recherche des pages carrières personnalisées pour ${country}...`);

        const configPath = path.resolve(__dirname, '../../../config/custom_providers.json');
        let customProviders = [];

        try {
            const data = await fs.readFile(configPath, 'utf-8');
            customProviders = JSON.parse(data);
        } catch (err) {
            console.warn(`⚠️ [GenericCustomProvider] Impossible de lire custom_providers.json : ${err.message}`);
            return [];
        }

        const matchingProviders = customProviders.filter(
            (provider) => normalizeCountry(provider.country) === normalizeCountry(country)
        );

        if (matchingProviders.length === 0) {
            return [];
        }

        const query = `${jobTitle} ${keywords}`.trim();
        const results = [];

        for (const provider of matchingProviders) {
            if (!provider?.url_pattern || !provider?.selector || !provider?.title_selector || !provider?.company_selector || !provider?.link_selector) {
                continue;
            }

            const searchUrl = buildJobUrl(provider.url_pattern, query);

            try {
                const jobs = await browserScrape(
                    searchUrl,
                    provider.selector,
                    provider.title_selector,
                    provider.company_selector,
                    provider.link_selector
                );

                jobs.forEach((job) => {
                    results.push({
                        title: job.title,
                        company: job.company || provider.name || 'Entreprise inconnue',
                        link: job.link,
                        location: city ? `${city}, ${country}` : country,
                        city: city || '',
                        salary: 'N/A',
                        contract_type: contractType || 'Non spécifié',
                        experience_level: experienceLevel || '',
                        remote: remote || '',
                        job_type: jobType || '',
                        date_posted: new Date().toISOString().split('T')[0],
                        provider: this.id,
                        provider_name: `${this.name} (${provider.name || 'custom'})`,
                        description: `Offre extraite depuis ${provider.name || 'un provider personnalisé'}.`
                    });
                });
            } catch (err) {
                console.error(`❌ [GenericCustomProvider] Échec sur ${provider.name || provider.url_pattern}: ${err.message}`);
            }
        }

        return results.slice(0, limit);
    }

    supportsAutoApply() {
        return false;
    }
}
