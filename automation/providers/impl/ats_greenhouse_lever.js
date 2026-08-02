import { BaseProvider } from '../base_provider.js';
import axios from 'axios';

export class AtsProvider extends BaseProvider {
    constructor() {
        super({
            id: 'ats_platforms',
            name: 'Enterprise ATS (Greenhouse, Lever, Ashby, Workday)',
            type: 'company_ats',
            countries: ['*'],
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', city = '', experienceLevel = '', contractType = '', remote = '', jobType = '', limit = 20 }) {
        console.log(`🏢 [AtsProvider] Recherche sur les plateformes d'entreprises ATS: ${jobTitle} ville=${city}...`);
        
        // Example integration for popular public ATS endpoints (Greenhouse, Lever)
        const sampleAtsBoards = [
            { company: 'GitLab', ats: 'greenhouse', boardToken: 'gitlab' },
            { company: 'Canonical', ats: 'greenhouse', boardToken: 'canonical' },
            { company: 'Automattic', ats: 'greenhouse', boardToken: 'automattic' },
            { company: 'Docker', ats: 'greenhouse', boardToken: 'docker' },
            { company: 'Postman', ats: 'lever', boardToken: 'postman' }
        ];

        const results = [];
        const term = (jobTitle + ' ' + keywords).toLowerCase();

        for (const board of sampleAtsBoards) {
            try {
                if (board.ats === 'greenhouse') {
                    const url = `https://boards-api.greenhouse.io/v1/boards/${board.boardToken}/jobs`;
                    const res = await axios.get(url, { timeout: 5000 });
                    if (res.data && res.data.jobs) {
                        const matched = res.data.jobs.filter(j => 
                            j.title.toLowerCase().includes(jobTitle.toLowerCase()) || 
                            keywords.split(' ').some(k => k && j.title.toLowerCase().includes(k.toLowerCase()))
                        );
                        matched.forEach(j => {
                            const locName = j.location?.name || 'International / Multiple';
                            const isRemote = locName.toLowerCase().includes('remote') || locName.toLowerCase().includes('virtual');
                            results.push({
                                title: j.title,
                                company: board.company,
                                link: j.absolute_url,
                                location: locName,
                                city: city || '',
                                salary: 'Selon grille entreprise',
                                contract_type: contractType || 'CDI / Full-time',
                                experience_level: experienceLevel || '',
                                remote: isRemote ? 'full_remote' : (remote || 'on_site'),
                                job_type: jobType || 'full_time',
                                date_posted: j.updated_at ? j.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
                                provider: this.id,
                                provider_name: `${this.name} (${board.company})`,
                                description: `Poste de ${j.title} chez ${board.company} géré par Greenhouse ATS.`
                            });
                        });
                    }
                }
            } catch (e) {
                // Ignore individual board fetch error
            }
        }

        return results.slice(0, limit);
    }

    supportsAutoApply(job) {
        // Lever and Greenhouse have clean public API/Form submissions that can be automated or pre-filled.
        return true;
    }
}
