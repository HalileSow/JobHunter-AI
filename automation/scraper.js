import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Scrape des offres d'emploi à partir d'une URL.
 * @param {string} url - L'URL de la page de recherche.
 * @param {string} selector - Le sélecteur CSS pour l'élément "carte" de l'offre.
 * @param {string} titleSelector - Le sélecteur pour le titre.
 * @param {string} companySelector - Le sélecteur pour l'entreprise.
 * @param {string} linkSelector - Le sélecteur pour le lien.
 * @returns {Promise<Array>} - Une liste d'objets d'offres.
 */
export async function scrapeJobs(url, selector, titleSelector, companySelector, linkSelector) {
  try {
    console.log(`🔍 Scraping de : ${url}...`);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const jobs = [];

    $(selector).each((i, el) => {
      const title = $(el).find(titleSelector).text().trim();
      const company = $(el).find(companySelector).text().trim();
      let link = $(el).find(linkSelector).attr('href');

      if (link && !link.startsWith('http')) {
        const urlObj = new URL(url);
        link = `${urlObj.protocol}//${urlObj.host}${link}`;
      }

      if (title && company && link) {
        jobs.push({ title, company, link });
      }
    });

    console.log(`✅ ${jobs.length} offres trouvées.`);
    return jobs;
  } catch (error) {
    console.error("❌ Erreur lors du scraping :", error.message);
    return [];
  }
}
