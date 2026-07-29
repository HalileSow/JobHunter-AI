import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { browserScrape } from '../browser_scraper.js';
import { scrapeJobs } from '../scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Moteur de scraping générique basé sur la configuration de custom_providers.json.
 */
export async function searchJobs(country, jobTitle, keywords) {
    console.log(`🔍 Vérification des fournisseurs génériques personnalisés pour ${country}...`);
    
    try {
        const configPath = path.resolve(__dirname, '../../config/custom_providers.json');
        const data = await fs.readFile(configPath, 'utf-8');
        const customProviders = JSON.parse(data);

        // Trouver tous les providers configurés pour ce pays
        const matchingProviders = customProviders.filter(
            p => p.country.toLowerCase() === country.toLowerCase()
        );

        if (matchingProviders.length === 0) {
            console.log(`ℹ️ Aucun fournisseur générique configuré dans custom_providers.json pour le pays: ${country}`);
            return [];
        }

        let allJobs = [];
        const query = encodeURIComponent(`${jobTitle} ${keywords}`);

        for (const prov of matchingProviders) {
            const searchUrl = prov.url_pattern.replace('{query}', query);
            console.log(`🌐 Scraping via fournisseur personnalisé [${prov.name}] : ${searchUrl}`);
            
            try {
                // Essayer d'abord en statique, si besoin avec Playwright
                // On utilise Playwright (browserScrape) par défaut pour plus de fiabilité sur les sites modernes
                const jobs = await browserScrape(
                    searchUrl,
                    prov.selector,
                    prov.title_selector,
                    prov.company_selector,
                    prov.link_selector
                );

                const mappedJobs = jobs.map(job => ({
                    ...job,
                    salary: "N/A",
                    contract_type: "Non spécifié",
                    date_posted: new Date().toISOString().split('T')[0]
                }));

                allJobs = allJobs.concat(mappedJobs);
            } catch (err) {
                console.error(`❌ Échec pour le fournisseur personnalisé [${prov.name}]:`, err.message);
            }
        }

        return allJobs;
    } catch (err) {
        console.error("❌ Erreur dans generic_custom provider:", err.message);
        return [];
    }
}
