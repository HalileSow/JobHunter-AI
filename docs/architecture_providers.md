# 🏗️ Architecture Multi-Providers & Auto-Dépôt JobHunter-AI

JobHunter-AI intègre un système de providers modulaire, extensible et agnostique. Il n'est pas limité à LinkedIn ou à une plateforme unique.

## 📌 1. Vue d'Ensemble des Providers

Le système se compose d'une classe abstraite `BaseProvider` et d'un registre centralisé `ProviderRegistry`.

```
                  ┌──────────────────────────────┐
                  │    ProviderRegistry          │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┼────────────────────────┐
         ▼                       ▼                        ▼
┌──────────────────┐   ┌──────────────────┐    ┌────────────────────┐
│ LinkedInProvider │   │ AdzunaProvider   │    │  AtsProvider       │
│ (Job Board)      │   │ (API Officielle) │    │ (Greenhouse/Lever) │
└──────────────────┘   └──────────────────┘    └────────────────────┘
         │                       │                        │
         ┌───────────────────────┼────────────────────────┘
                                 ▼
                   ┌──────────────────────────┐
                   │  SearchEngine (Parallel) │
                   └─────────────┬────────────┘
                                 │
                   ┌─────────────▼────────────┐
                   │ Dédoublonnage Hash SHA256│
                   └─────────────┬────────────┘
                                 │
                   ┌─────────────▼────────────┐
                   │ Classification & IA Score│
                   └──────────────────────────┘
```

### Type de Providers Supportés
1. **Job Boards** : LinkedIn, Indeed, StepStone, Monster...
2. **APIs Officielles** : Adzuna, France Travail (Open Data), Remotive...
3. **Sites Carrières / ATS** : Greenhouse, Lever, Workday, SmartRecruiters...
4. **Scraping Carrières Sur-Mesure** : Playwright + Extraction IA pour n'importe quel site web.

---

## 🛠️ 2. Comment Ajouter un Nouveau Provider

Pour ajouter un nouveau site d'emploi ou une nouvelle API (ex: `Monster`, `Glassdoor` ou l'API d'un service national) :

### Étape 1 : Créer le fichier provider dans `automation/providers/impl/`
```js
// automation/providers/impl/mon_provider.js
import { BaseProvider } from '../base_provider.js';

export class MonProvider extends BaseProvider {
    constructor() {
        super({
            id: 'mon_provider',
            name: 'Mon Site Emploi',
            type: 'job_board', // 'official_api' | 'company_ats' | 'custom_scraper'
            countries: ['France', 'Sénégal', '*'], // Pays supportés ou '*'
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', limit = 20 }) {
        // Logique de recherche (API REST, GraphQL ou Playwright/Cheerio)
        return [
            {
                title: "Développeur Fullstack",
                company: "Entreprise X",
                link: "https://exemple.com/job/123",
                location: country,
                salary: "45k - 55k",
                contract_type: "CDI",
                date_posted: "2026-07-29",
                provider: this.id,
                provider_name: this.name,
                description: "Description de l'offre..."
            }
        ];
    }

    supportsAutoApply(job) {
        // Retourne true si une API de candidature directe existe
        return false;
    }
}
```

### Étape 2 : Déclarer le provider dans `automation/providers/registry.js`
```js
import { MonProvider } from './impl/mon_provider.js';

// Dans registerBuiltInProviders() :
this.register(new MonProvider());
```

C'est tout ! Le moteur inclura automatiquement votre nouveau provider dans les recherches en parallèle.

---

## 🔄 3. Dédoublonnage et Agrégation Intelligent

Le `SearchEngine` exécute la recherche en parallèle sur tous les providers actifs via `Promise.allSettled` avec timeout de sécurité.

Les offres sont dédoublonnées via un empreinte SHA-256 calculée ainsi :
`dedup_hash = sha256(canonical(company) + '|' + canonical(title) + '|' + canonical(location))`

Si une même offre apparaît sur plusieurs plateformes (ex: LinkedIn + Indeed + Adzuna), JobHunter-AI fusionne les métadonnées et liste toutes les sources associées.

---

## 🔒 4. Cycle de Candidature : Auto vs Confirmation

| Situation | Action de JobHunter-AI | Statut final |
| :--- | :--- | :--- |
| **Auto-Apply disponible & autorisé** | Soumission automatique directe (API/Playwright) | `Soumis` |
| **Dépôt restreint / Confirmation requise** | Génération de la lettre PDF + sélection du CV + préparation du dossier de formulaire pré-rempli | `En attente de confirmation` |

L'utilisateur peut valider une candidature `En attente de confirmation` en 1 clic sur l'interface Web ou télécharger le pack pré-rempli.
