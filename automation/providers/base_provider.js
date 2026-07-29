/**
 * BaseProvider interface for all JobHunter-AI search & submission providers.
 * Every provider (LinkedIn, Indeed, Adzuna, France Travail, ATS, Career Pages, etc.)
 * inherits from this class or implements its contract.
 */
export class BaseProvider {
    /**
     * @param {Object} options
     * @param {string} options.id - Unique ID (e.g. 'linkedin', 'adzuna')
     * @param {string} options.name - Human-readable provider name
     * @param {string} options.type - Category: 'job_board' | 'official_api' | 'company_ats' | 'custom_scraper'
     * @param {Array<string>} [options.countries=['*']] - Supported countries or ['*'] for all
     * @param {boolean} [options.enabled=true] - Whether enabled by default
     */
    constructor({ id, name, type, countries = ['*'], enabled = true }) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.countries = countries;
        this.enabled = enabled;
    }

    /**
     * Checks if provider supports a given country.
     * @param {string} country
     * @returns {boolean}
     */
    supportsCountry(country) {
        if (!this.countries || this.countries.includes('*')) return true;
        const normalized = country.toLowerCase().trim();
        return this.countries.some(c => c.toLowerCase().trim() === normalized);
    }

    /**
     * Search for jobs matching query. Must return normalized JobOffer objects.
     * @param {Object} params
     * @param {string} params.country - Target country (e.g. 'France', 'Allemagne', 'Côte d'Ivoire')
     * @param {string} params.jobTitle - Job title (e.g. 'Développeur Fullstack', 'Vendeur')
     * @param {string} [params.keywords=''] - Additional keywords
     * @param {number} [params.limit=20] - Max results
     * @returns {Promise<Array<Object>>} List of JobOffer objects
     */
    async searchJobs({ country, jobTitle, keywords = '', limit = 20 }) {
        throw new Error(`searchJobs() method must be implemented by provider ${this.id}`);
    }

    /**
     * Determines whether automated, non-interactive submission is supported and allowed for a given job.
     * @param {Object} job
     * @returns {boolean}
     */
    supportsAutoApply(job) {
        return false;
    }

    /**
     * Submit application automatically when supported and authorized.
     * @param {Object} job
     * @param {Object} candidateProfile
     * @param {string} cvPath
     * @param {string} letterText
     * @returns {Promise<Object>} Result details { success: boolean, confirmationId?: string, details?: string }
     */
    async submitApplication(job, candidateProfile, cvPath, letterText) {
        throw new Error(`submitApplication() not implemented for provider ${this.id}`);
    }

    /**
     * Prepare application pack (pre-filled fields JSON and direct link) when auto-apply is not possible or requires confirmation.
     * @param {Object} job
     * @param {Object} candidateProfile
     * @param {string} cvPath
     * @param {string} letterText
     * @returns {Promise<Object>} Pre-filled candidate package
     */
    async prepareApplicationPack(job, candidateProfile, cvPath, letterText) {
        return {
            providerId: this.id,
            providerName: this.name,
            applyUrl: job.link,
            candidate: {
                firstName: candidateProfile?.first_name || '',
                lastName: candidateProfile?.last_name || '',
                email: candidateProfile?.email || '',
                phone: candidateProfile?.phone || '',
                address: candidateProfile?.address || '',
                nationality: candidateProfile?.nationality || ''
            },
            letterText: letterText || '',
            cvPath: cvPath || '',
            autoApplyPossible: this.supportsAutoApply(job),
            instructions: `Candidature préparée à 100%. Ouvrez le lien direct (${job.link}) pour valider et coller la lettre de motivation.`
        };
    }
}
