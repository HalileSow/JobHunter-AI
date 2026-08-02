import { BaseProvider } from '../base_provider.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
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
            console.warn("⚠️ Impossible de charger config/career_pages.json. Mode sans fichier de config.");
            careerPages = [
                { company: "Decathlon", url: "https://recrutement.decathlon.fr/search?q={query}" },
                { company: "Orange", url: "https://job.orange.com/fr/offres?keyword={query}" }
            ];
        }

        let browser = null;
        const results = [];

        try {
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            });
            const page = await context.newPage();

            const query = `${jobTitle} ${keywords}`.trim();

            for (const cp of careerPages) {
                const searchUrl = cp.url.replace('{query}', encodeURIComponent(query));
                console.log(`🌐 Chargement du site carrières de ${cp.company} : ${searchUrl}`);

                try {
                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
                    await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
                    await page.waitForTimeout(1500);

                    const bodyText = await page.innerText('body');
                    if (bodyText.length < 150) continue;

                    const filters = [
                        city ? `ville="${city}"` : '',
                        contractType ? `type contrat="${contractType}"` : '',
                        remote === 'full_remote' ? 'télétravail=oui' : '',
                        experienceLevel ? `expérience="${experienceLevel}"` : ''
                    ].filter(Boolean).join(', ');

                    const prompt = `Tu es un assistant de recrutement.
Voici le contenu texte brut du site carrières de l'entreprise "${cp.company}" :
---
${bodyText.substring(0, 8000)}
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
        } catch (err) {
            console.error(`❌ Erreur Playwright CareerPages:`, err.message);
        } finally {
            if (browser) await browser.close();
        }

        return results.slice(0, limit);
    }

    supportsAutoApply(job) {
        return false;
    }
}
