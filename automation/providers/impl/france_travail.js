import { BaseProvider } from '../base_provider.js';
import axios from 'axios';

export class FranceTravailProvider extends BaseProvider {
    constructor() {
        super({
            id: 'france_travail',
            name: 'France Travail (API)',
            type: 'official_api',
            countries: ['France'],
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', city = '', experienceLevel = '', contractType = '', remote = '', jobType = '', limit = 20 }) {
        console.log(`🔍 [FranceTravailProvider] Recherche: ${jobTitle} (${keywords}) ville=${city} contrat=${contractType} remote=${remote}...`);

        const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
        const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.warn(`⚠️ [FranceTravailProvider] Credentials FRANCE_TRAVAIL_CLIENT_ID / CLIENT_SECRET non configurés.`);
            console.log(`ℹ️ [FranceTravailProvider] Utilisation de la passerelle d'accès public France Travail.`);
            return this.searchPublicFallback(jobTitle, keywords, limit);
        }

        try {
            const tokenUrl = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
            const authParams = new URLSearchParams();
            authParams.append('grant_type', 'client_credentials');
            authParams.append('client_id', clientId);
            authParams.append('client_secret', clientSecret);
            authParams.append('scope', 'o2dsoffre');

            const tokenRes = await axios.post(tokenUrl, authParams.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 8000
            });

            const accessToken = tokenRes.data.access_token;

            const searchParams = new URLSearchParams();
            searchParams.append('motsCles', `${jobTitle} ${keywords}`.trim());
            searchParams.append('range', `0-${limit - 1}`);

            if (city) searchParams.append('commune', city);
            if (contractType) {
                const typeMap = { 'CDI': 'CDI', 'CDD': 'CDD', 'Stage': 'STAGE', 'Alternance': 'ALTERNANCE', 'Freelance': 'FREELANCE' };
                if (typeMap[contractType]) searchParams.append('typeContrat', typeMap[contractType]);
            }
            if (remote === 'full_remote') searchParams.append('teletravail', '1');
            if (experienceLevel) {
                const expMap = { 'junior': '0-2', 'mid': '2-5', 'senior': '5-10', 'director': '10+' };
                if (expMap[experienceLevel]) searchParams.append('experience', expMap[experienceLevel]);
            }

            const searchUrl = `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${searchParams.toString()}`;
            const { data } = await axios.get(searchUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                timeout: 10000
            });

            if (!data.resultats) return [];

            return data.resultats.map(off => ({
                title: off.intitule,
                company: off.entreprise?.nom || 'Entreprise anonyme',
                link: off.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${off.id}`,
                location: off.lieuTravail?.libelle || 'France',
                city: off.lieuTravail?.libelle || '',
                salary: off.salaire?.libelle || 'Non spécifié',
                contract_type: off.typeContratLibelle || off.typeContrat || 'CDI/CDD',
                experience_level: experienceLevel,
                remote: off.teletravail ? 'full_remote' : 'on_site',
                date_posted: off.dateCreation ? off.dateCreation.split('T')[0] : new Date().toISOString().split('T')[0],
                provider: this.id,
                provider_name: this.name,
                description: off.description || ''
            }));
        } catch (err) {
            console.error(`❌ [FranceTravailProvider] Erreur : ${err.message}`);
            return this.searchPublicFallback(jobTitle, keywords, limit);
        }
    }

    async searchPublicFallback(jobTitle, keywords, limit) {
        try {
            const query = encodeURIComponent(`${jobTitle} ${keywords}`.trim());
            const searchUrl = `https://candidat.francetravail.fr/offres/recherche?motsCles=${query}`;

            const { data } = await axios.get(
                `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?motsCles=${query}&range=0-${Math.min(limit - 1, 49)}`,
                { timeout: 8000, headers: { 'Accept': 'application/json' } }
            ).catch(() => ({ data: null }));

            if (data?.resultats?.length) {
                return data.resultats.slice(0, limit).map(off => ({
                    title: off.intitule,
                    company: off.entreprise?.nom || 'Entreprise anonyme',
                    link: off.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/${off.id}`,
                    location: off.lieuTravail?.libelle || 'France',
                    city: off.lieuTravail?.libelle || '',
                    salary: off.salaire?.libelle || 'Non spécifié',
                    contract_type: off.typeContratLibelle || off.typeContrat || 'Non spécifié',
                    date_posted: off.dateCreation ? off.dateCreation.split('T')[0] : new Date().toISOString().split('T')[0],
                    provider: this.id,
                    provider_name: this.name,
                    description: off.description || ''
                }));
            }

            return [{
                title: `Recherche France Travail : ${jobTitle}`,
                company: 'France Travail',
                link: searchUrl,
                location: 'France',
                salary: 'Non spécifié',
                contract_type: 'Non spécifié',
                date_posted: new Date().toISOString().split('T')[0],
                provider: this.id,
                provider_name: this.name,
                description: `Lien vers les résultats de recherche France Travail pour "${jobTitle}". Configurez FRANCE_TRAVAIL_CLIENT_ID et FRANCE_TRAVAIL_CLIENT_SECRET dans .env pour accéder aux offres détaillées via l'API officielle.`
            }];
        } catch (err) {
            return [];
        }
    }

    supportsAutoApply(job) {
        return false;
    }
}
