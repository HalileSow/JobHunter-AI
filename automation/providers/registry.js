import { LinkedInProvider } from './impl/linkedin.js';
import { IndeedProvider } from './impl/indeed.js';
import { AdzunaProvider } from './impl/adzuna.js';
import { FranceTravailProvider } from './impl/france_travail.js';
import { RemotiveProvider } from './impl/remotive.js';
import { AtsProvider } from './impl/ats_greenhouse_lever.js';
import { CareerPagesProvider } from './impl/career_pages.js';

export class ProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.registerBuiltInProviders();
    }

    registerBuiltInProviders() {
        this.register(new LinkedInProvider());
        this.register(new IndeedProvider());
        this.register(new AdzunaProvider());
        this.register(new FranceTravailProvider());
        this.register(new RemotiveProvider());
        this.register(new AtsProvider());
        this.register(new CareerPagesProvider());
    }

    /**
     * Enregistre un nouveau provider.
     * @param {BaseProvider} provider
     */
    register(provider) {
        if (!provider || !provider.id) {
            throw new Error('Provider invalide : identifiant obligatoire.');
        }
        this.providers.set(provider.id, provider);
        console.log(`🔌 Provider enregistré : ${provider.name} (${provider.id}) [Type: ${provider.type}]`);
    }

    /**
     * Récupère un provider par son ID.
     * @param {string} id
     * @returns {BaseProvider|undefined}
     */
    get(id) {
        return this.providers.get(id);
    }

    /**
     * Récupère tous les providers enregistrés.
     * @returns {Array<BaseProvider>}
     */
    getAll() {
        return Array.from(this.providers.values());
    }

    /**
     * Récupère les providers actifs qui supportent un pays donné.
     * @param {string} country
     * @returns {Array<BaseProvider>}
     */
    getEnabledForCountry(country) {
        return this.getAll().filter(p => p.enabled && p.supportsCountry(country));
    }

    /**
     * Active ou désactive un provider.
     * @param {string} id
     * @param {boolean} enabled
     */
    setEnabled(id, enabled) {
        const provider = this.get(id);
        if (provider) {
            provider.enabled = enabled;
            return true;
        }
        return false;
    }

    /**
     * Retourne la liste des métadonnées des providers pour l'interface UI.
     */
    getMetadataList() {
        return this.getAll().map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            countries: p.countries,
            enabled: p.enabled
        }));
    }
}

export const defaultRegistry = new ProviderRegistry();
