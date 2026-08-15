import { BaseProvider } from '../base_provider.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowser, releaseBrowser, closeBrowser, createPageWithRetry } from '../../browser_pool.js';
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
        let context = null;
        let page = null;
        const results = [];

        try {
            // OPTIMISATION MÉMOIRE : Utiliser le pool de browsers avec retry automatique
            const browserResult = await getBrowser();
            browser = browserResult.browser;
            lock = browserResult.lock;

            const pageResult = await createPageWithRetry(browser, lock);
            context = pageResult.context;
            page = pageResult.page;
            lock = pageResult.lock;

            const query = `${jobTitle} ${keywords}`.trim();

            for (const cp of careerPages) {
                const searchUrl = cp.url.replace('{query}', encodeURIComponent(query));
                console.log(`🌐 Chargement du site carrières de ${cp.company} : ${searchUrl}`);

                try {
                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
                    await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
                    await new Promise(r => setTimeout(r, 1500));

                    const bodyText = await page.innerText('body');
                    if (bodyText.length < 150) continue;
                    const truncatedText = bodyText.substring(0, 4000);

                    const pageLinks = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('a[href]'))
                            .filter(a => {
                                const text = (a.innerText || '').trim();
                                const href = a.href || '';
                                return text.length > 5 && href.startsWith('http') && !href.includes('javascript:');
                            })
                            .slice(0, 30)
                            .map(a => ({ text: (a.innerText || '').trim().substring(0, 100), url: a.href }));
                    });

                    const linksSection = pageLinks.length > 0
                        ? `\nLiens visibles sur la page :\n${pageLinks.map(l => `- "${l.text}" → ${l.url}`).join('\n')}`
                        : '';

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
---${linksSection}
Extrais jusqu'à 3 offres d'emploi qui correspondent au poste "${jobTitle}" / mots-clés "${keywords}"${filters ? `. Filtres supplémentaires : ${filters}` : ''}.
Pour chaque offre, utilise le lien URL réel de l'offre si disponible dans la liste des liens ci-dessus. Sinon utilise "${searchUrl}".
Format JSON strict :
[
  {
    "title": "Titre exact de l'offre",
    "company": "${cp.company}",
    "link": "URL réelle de l'offre individuelle",
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
        } catch (err) {
            console.error(`❌ Erreur Playwright CareerPages:`, err.message);
        } finally {
            // OPTIMISATION MÉMOIRE : Fermer le context et libérer le lock
            if (page) await page.close().catch(() => {});
            if (context) await context.close().catch(() => {});
            if (lock) releaseBrowser(lock);
            await closeBrowser();
        }

        return results.slice(0, limit);
    }

    supportsAutoApply(job) {
        return false;
    }
}
