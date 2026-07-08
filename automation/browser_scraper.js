import { chromium } from 'playwright';

/**
 * Scrape des offres d'emploi en simulant un vrai navigateur.
 * @param {string} url - L'URL de la recherche.
 * @param {string} selector - Le sélecteur CSS pour l'élément "carte" de l'offre.
 * @param {string} titleSelector - Le sélecteur pour le titre.
 * @param {string} companySelector - Le sélecteur pour l'entreprise.
 * @param {string} linkSelector - Le sélecteur pour le lien.
 * @returns {Promise<Array>} - Une liste d'objets d'offres.
 */
export async function browserScrape(url, selector, titleSelector, companySelector, linkSelector) {
  const browser = await chromium.launch({ headless: true }); // headless: true pour ne pas ouvrir de fenêtre visible
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log(`🌐 Navigation vers : ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Petit scroll pour simuler un humain et charger le contenu dynamique
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(2000); 

    console.log("🔍 Extraction des données...");
    const jobs = await page.evaluate((sel, tSel, cSel, lSel) => {
      const results = [];
      const elements = document.querySelectorAll(sel);
      
      elements.forEach(el => {
        const titleEl = el.querySelector(tSel);
        const companyEl = el.querySelector(cSel);
        const linkEl = el.querySelector(lSel);

        if (titleEl && companyEl && linkEl) {
          results.push({
            title: titleEl.innerText.trim(),
            company: companyEl.innerText.trim(),
            link: linkEl.href
          });
        }
      });
      return results;
    }, selector, titleSelector, companySelector, linkSelector);

    console.log(`✅ ${jobs.length} offres trouvées avec Playwright.`);
    await browser.close();
    return jobs;

  } catch (error) {
    console.error("❌ Erreur lors du scraping navigateur :", error.message);
    await browser.close();
    return [];
  }
}
