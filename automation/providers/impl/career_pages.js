import { BaseProvider } from '../base_provider.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowser, releaseBrowser, createBrowserContext } from '../../browser_pool.js';
import { callGemini } from '../../ai_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CareerPagesProvider extends BaseProvider {
    constructor() {
        super({
            id: 'career_pages',
            name: 'Enterprise Career Pages (Playwright + IA)',
            type: 'custom_scraper',
            countries: ['*'],
            enabled: true
        });
    }

    async searchJobs({ country, jobTitle, keywords = '', city = '', experienceLevel = '', contractType = '', remote = '', jobType = '', limit = 20 }) {
        console.log(`🏢 [CareerPagesProvider] Exploration dynamique des sites carrières: ${jobTitle} ville=${city}...`);

        let configPath = path.resolve(__dirname, '../../../config/career_pages.json');
        let careerPages = [];
        try {
            const data = await fs.readFile(configPath, 'utf-8');
            careerPages = JSON.parse(data);
        } catch (err) {
            console.warn("⚠️ Impossible de charger config/career_pages.json. Utilisation de la config par défaut.");
            careerPages = [
                { company: "Decathlon", url: "https://recrutement.decathlon.fr/search?q={query}" },
                { company: "Orange", url: "https://job.orange.com/fr/offres?keyword={query}" }
            ];
        }

        let browser = null;
        let lock = null;
        const results = [];

        try {
            // OPTIMISATION MÉMOIRE : Utiliser le pool de browsers au lieu de lancer une nouvelle instance
            const browserResult = await getBrowser();
            browser = browserResult.browser;
            lock = browserResult.lock;
            
            const context = await createBrowserContext(browser);
            const page = await context.newPage();

            const query = `${jobTitle} ${keywords}`.trim();

            for (const cp of careerPages) {
                const searchUrl = cp.url.replace('{query}', encodeURIComponent(query));
                console.log(`🌐 Chargement du site carrières de ${cp.company} : ${searchUrl}`);

                try {
                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
                    await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
                    await page.waitForTimeout(1500);

                    // OPTIMISATION MÉMOIRE : Limiter la taille du texte extrait à 4000 caractères
                    // pour réduire la mémoire utilisée par les prompts IA
                    const bodyText = await page.innerText('body');
                    if (bodyText.length < 150) continue;
                    const truncatedText = bodyText.substring(0, 4000);

                    const filters = [
                        city ? `ville="${city}"` : '',
                        contractType ? `type contrat="${contractType}"` : '',
                        remote === 'full_remote' ? 'télétravail=oui' : '',
                        experienceLevel ? `expérience="${experienceLevel}"` : ''
                    ].filter(Boolean).join(', ');

                    const prompt = `Tu es un assistant de recrutement.
Voici le contenu texte brut du site carrières de l'entreprise "${cp.company}" :
---
${truncatedText}
---
Extrais jusqu'à 3 offres d'emploi qui correspondent au poste "${jobTitle}" / mots-clés "${keywords}"${filters ? `. Filtres supplémentaires : ${filters}` : ''}.
Format JSON strict :
[
  {
    "title": "Titre exact de l'offre",
    "company": "${cp.company}",
    "link": "${searchUrl}",
    "location": "${country}",
    "city": "${city}",
    "contract_type": "CDI/CDD",
    "experience_level": "",
    "remote": "on_site",
    "salary": "N/A",
    "date_posted": "${new Date().toISOString().split('T')[0]}"
  }
]
Si aucune offre pertinente, réponds avec [].`;

                    const aiResponse = await callGemini(prompt);
                    const parsed = JSON.parse(aiResponse);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(j => {
                            results.push({
                                ...j,
                                provider: this.id,
                                provider_name: `${this.name} (${cp.company})`
                            });
                        });
                    }
                } catch (err) {
                    console.error(`❌ Erreur site carrières ${cp.company}:`, err.message);
                }
            }
            
            // Fermer le context mais pas le browser (il est réutilisé)
            await context.close().catch(() => {});
        } catch (err) {
            console.error(`❌ Erreur Playwright CareerPages:`, err.message);
        } finally {
            // OPTIMISATION MÉMOIRE : Libérer le lock du pool, pas fermer le browser
            if (lock) releaseBrowser(lock);
        }

        return results.slice(0, limit);
    }

    supportsAutoApply(job) {
        return false;
    }
}
