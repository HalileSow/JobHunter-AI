import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowser, releaseBrowser, closeBrowser, createPageWithRetry } from '../browser_pool.js';
import { callGemini } from '../ai_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Provider intelligent pour les pages carrières d'entreprises.
 * Il utilise Playwright pour charger la page, puis l'IA pour extraire les offres correspondantes.
 */
export async function searchJobs(country, jobTitle, keywords) {
    console.log(`🏢 Recherche sur les pages carrières d'entreprises...`);

    let configPath = path.resolve(__dirname, '../../config/career_pages.json');
    let careerPages = [];
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        careerPages = JSON.parse(data);
    } catch (err) {
        console.warn("⚠️ Impossible de charger career_pages.json. Ce fournisseur est ignoré.");
        return [];
    }

    // OPTIMISATION MÉMOIRE : Utiliser le pool de browsers avec retry automatique
    let lock = null;
    let context = null;
    let page = null;
    const results = [];

    try {
        const browserResult = await getBrowser();
        const browser = browserResult.browser;
        lock = browserResult.lock;

        const pageResult = await createPageWithRetry(browser, lock);
        context = pageResult.context;
        page = pageResult.page;
        lock = pageResult.lock;

        const query = `${jobTitle} ${keywords}`;

        for (const cp of careerPages) {
            const searchUrl = cp.url.replace('{query}', encodeURIComponent(query));
            console.log(`🌐 Chargement de la page carrières de ${cp.company} : ${searchUrl}`);

            try {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
                await page.waitForTimeout(2000);

                // Récupérer le contenu de la page sous forme textuelle
                // OPTIMISATION MÉMOIRE : Limiter à 4000 caractères pour réduire la mémoire
                const bodyText = await page.innerText('body');

                // Si la page est trop courte ou contient une erreur évidente
                if (bodyText.length < 200) {
                    console.log(`⚠️ Contenu trop court pour ${cp.company}.`);
                    continue;
                }

                console.log(`🤖 IA analyse la page carrières de ${cp.company}...`);
                const prompt = `Tu es un assistant de recrutement.
Voici le contenu texte brut de la page carrières de l'entreprise "${cp.company}" :
---
${bodyText.substring(0, 4000)}
---

Extrais de ce texte une liste de jusqu'à 5 offres d'emploi correspondant le mieux au poste : "${jobTitle}" avec les mots-clés "${keywords}".
Pour chaque offre, retourne :
- "title" : Titre exact de l'offre.
- "company" : "${cp.company}"
- "link" : Le lien direct pour postuler (si présent dans le texte ou les attributs, sinon l'URL de recherche : "${searchUrl}").
- "location" : Ville/Pays (si spécifié).
- "contract_type" : CDD, CDI, Alternance, Stage, etc. (si spécifié).
- "salary" : Salaire (si spécifié, sinon "N/A").
- "date_posted" : Date de publication (format YYYY-MM-DD ou date actuelle).

Réponds UNIQUEMENT avec un tableau JSON valide au format suivant :
[
  {
    "title": "...",
    "company": "${cp.company}",
    "link": "...",
    "location": "...",
    "contract_type": "...",
    "salary": "...",
    "date_posted": "..."
  }
]
Si aucune offre ne correspond, retourne un tableau vide : []`;

                const aiResponse = await callGemini(prompt);
                try {
                    const parsedJobs = JSON.parse(aiResponse);
                    if (Array.isArray(parsedJobs)) {
                        console.log(`✅ ${parsedJobs.length} offres extraites par IA pour ${cp.company}`);
                        results.push(...parsedJobs);
                    }
                } catch (err) {
                    console.warn(`⚠️ Échec de l'analyse JSON par l'IA pour ${cp.company} :`, err.message);
                }

            } catch (err) {
                console.error(`❌ Erreur lors du chargement de la page de ${cp.company} :`, err.message);
            }
        }
    } catch (err) {
        console.error(`❌ Erreur Playwright CareerPages:`, err.message);
    } finally {
        // Libérer aussi le processus Chromium entre les providers.
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        await closeBrowser();
        if (lock) releaseBrowser(lock);
    }

    return results;
}
