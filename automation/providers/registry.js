import { LinkedInProvider } from './impl/linkedin.js';
import { IndeedProvider } from './impl/indeed.js';
import { AdzunaProvider } from './impl/adzuna.js';
import { FranceTravailProvider } from './impl/france_travail.js';
import { RemotiveProvider } from './impl/remotive.js';
import { AtsProvider } from './impl/ats_greenhouse_lever.js';
import { CareerPagesProvider } from './impl/career_pages.js';
import { GenericCustomProvider } from './impl/generic_custom.js';

export class ProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.registerBuiltInProviders();
    }

    registerBuiltInProviders() {
        // Providers sans Chromium (API) — activés par défaut
        this.register(new AdzunaProvider());
        this.register(new FranceTravailProvider());
        this.register(new RemotiveProvider());
        this.register(new AtsProvider());
        // Providers avec Chromium (Playwright) — désactivés par défaut
        // car ils consomment trop de mémoire sur Render Starter (512 Mo).
        // Réactivable via l'interface admin.
        this.register(new LinkedInProvider());
        this.register(new IndeedProvider());
        this.register(new CareerPagesProvider());
        this.register(new GenericCustomProvider());
        this._disableChromiumProviders();
    }

    /**
     * Désactive les providers qui nécessitent Chromium/Playwright
     * pour éviter les OOM kills sur Render Starter.
     */
    _disableChromiumProviders() {
        const chromiumProviders = ['linkedin', 'indeed', 'career_pages', 'generic_custom'];
        for (const id of chromiumProviders) {
            const p = this.get(id);
            if (p) p.enabled = false;
        }
        console.log('🔌 Providers Chromium désactivés par défaut (économie mémoire).');
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
     * Récupère les providers activés, sans filtrage pays.
     * Utile pour les recherches planifiées qui doivent balayer toutes les sources actives.
     */
    getEnabled() {
        return this.getAll().filter((provider) => provider.enabled);
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
