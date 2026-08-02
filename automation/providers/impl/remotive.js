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

    async searchJobs({ country, jobTitle, keywords = '', city = '', experienceLevel = '', contractType = '', remote = '', jobType = '', limit = 20 }) {
        console.log(`🔍 [RemotiveProvider] Recherche d'offres Remote Worldwide: ${jobTitle} (${keywords})...`);

        try {
            const category = this.resolveCategory(jobTitle);
            const searchParams = new URLSearchParams();
            searchParams.append('search', `${jobTitle} ${keywords}`.trim());
            searchParams.append('limit', String(limit));
            if (category) searchParams.append('category', category);

            const url = `https://remotive.com/api/remote-jobs?${searchParams.toString()}`;
            const { data } = await axios.get(url, { timeout: 8000 });

            if (!data.jobs) return [];

            return data.jobs.slice(0, limit).map(job => ({
                title: job.title,
                company: job.company_name,
                link: job.url,
                location: job.candidate_required_location || 'Worldwide / Remote',
                city: '',
                salary: job.salary || 'Non spécifié',
                contract_type: job.job_type || 'Full-time Remote',
                experience_level: '',
                remote: 'full_remote',
                job_type: this.normalizeJobType(job.job_type),
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

    resolveCategory(jobTitle) {
        const title = jobTitle.toLowerCase();
        if (title.includes('dev') || title.includes('engineer') || title.includes('software')) return 'software-dev';
        if (title.includes('design')) return 'design';
        if (title.includes('market')) return 'marketing';
        if (title.includes('data')) return 'data';
        if (title.includes('product')) return 'product';
        if (title.includes('sales') || title.includes('business')) return 'sales-and-business';
        return '';
    }

    normalizeJobType(raw) {
        if (!raw) return 'full_time';
        const lower = raw.toLowerCase();
        if (lower.includes('part')) return 'part_time';
        if (lower.includes('contract')) return 'full_time';
        return 'full_time';
    }

    supportsAutoApply(job) {
        return false;
    }
}
