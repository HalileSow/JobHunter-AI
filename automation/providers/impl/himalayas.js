import { BaseProvider } from '../base_provider.js';
import axios from 'axios';

export class HimalayasProvider extends BaseProvider {
    constructor() {
        super({
            id: 'himalayas',
            name: 'Himalayas Remote Jobs',
            type: 'official_api',
            countries: ['*'], // Worldwide remote jobs
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', city = '', experienceLevel = '', contractType = '', remote = '', jobType = '', limit = 20 }) {
        console.log(`🔍 [HimalayasProvider] Recherche offres Remote Worldwide: ${jobTitle} (${keywords})...`);

        try {
            const url = 'https://himalayas.app/api/jobs';
            const { data } = await axios.get(url, {
                params: {
                    search: `${jobTitle} ${keywords}`.trim() || undefined,
                    limit: limit
                },
                timeout: 10000
            });

            if (!data || !data.jobs || data.jobs.length === 0) return [];

            return data.jobs.slice(0, limit).map(job => ({
                title: job.title || '',
                company: job.company?.name || '',
                link: `https://himalayas.app${job.slug ? `/jobs/${job.slug}` : '#'}`,
                location: job.locations?.map(l => l.name).join(', ') || 'Worldwide / Remote',
                city: '',
                salary: job.salary?.min && job.salary?.max
                    ? `${job.salary.currency} ${job.salary.min.toLocaleString()} - ${job.salary.max.toLocaleString()}`
                    : 'Non spécifié',
                contract_type: job.jobType || 'Full-time Remote',
                experience_level: job.experienceLevel || '',
                remote: 'full_remote',
                job_type: this.normalizeJobType(job.jobType),
                date_posted: job.publishDate ? job.publishDate.split('T')[0] : new Date().toISOString().split('T')[0],
                provider: this.id,
                provider_name: this.name,
                description: job.description ? job.description.replace(/<[^>]*>?/gm, '').substring(0, 500) : ''
            }));
        } catch (err) {
            console.error(`❌ [HimalayasProvider] Erreur API Himalayas : ${err.message}`);
            return [];
        }
    }

    normalizeJobType(raw) {
        if (!raw) return 'full_time';
        const lower = raw.toLowerCase();
        if (lower.includes('part')) return 'part_time';
        if (lower.includes('contract') || lower.includes('freelance')) return 'contract';
        if (lower.includes('intern')) return 'internship';
        return 'full_time';
    }

    supportsAutoApply(job) {
        return false;
    }
}
