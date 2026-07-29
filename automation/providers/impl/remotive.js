import { BaseProvider } from '../base_provider.js';
import axios from 'axios';

export class RemotiveProvider extends BaseProvider {
    constructor() {
        super({
            id: 'remotive',
            name: 'Remotive Remote API',
            type: 'official_api',
            countries: ['*'], // Worldwide remote jobs
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', limit = 20 }) {
        console.log(`🔍 [RemotiveProvider] Recherche d'offres Remote Worldwide: ${jobTitle} (${keywords})...`);

        try {
            const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(jobTitle + ' ' + keywords)}&limit=${limit}`;
            const { data } = await axios.get(url, { timeout: 8000 });

            if (!data.jobs) return [];

            return data.jobs.slice(0, limit).map(job => ({
                title: job.title,
                company: job.company_name,
                link: job.url,
                location: job.candidate_required_location || 'Worldwide / Remote',
                salary: job.salary || 'Non spécifié',
                contract_type: job.job_type || 'Full-time Remote',
                date_posted: job.publication_date ? job.publication_date.split('T')[0] : new Date().toISOString().split('T')[0],
                provider: this.id,
                provider_name: this.name,
                description: job.description ? job.description.replace(/<[^>]*>?/gm, '').substring(0, 500) : ''
            }));
        } catch (err) {
            console.error(`❌ [RemotiveProvider] Erreur API Remotive : ${err.message}`);
            return [];
        }
    }

    supportsAutoApply(job) {
        return false;
    }
}
