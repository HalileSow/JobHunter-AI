import { getBrowser, releaseBrowser, createPageWithRetry } from './browser_pool.js';

/**
 * Scrape des offres d'emploi en simulant un vrai navigateur.
 * OPTIMISATION MÉMOIRE : Utilise le pool de browsers au lieu de lancer une nouvelle instance.
 * @param {string} url - L'URL de la recherche.
 * @param {string} selector - Le sélecteur CSS pour l'élément "carte" de l'offre.
 * @param {string} titleSelector - Le sélecteur pour le titre.
 * @param {string} companySelector - Le sélecteur pour l'entreprise.
 * @param {string} linkSelector - Le sélecteur pour le lien.
 * @returns {Promise<Array>} - Une liste d'objets d'offres.
 */
export async function browserScrape(url, selector, titleSelector, companySelector, linkSelector) {
  let lock = null;
  let context = null;
  let page = null;

  try {
    // OPTIMISATION MÉMOIRE : Utiliser le pool de browsers avec retry automatique
    const browserResult = await getBrowser();
    const browser = browserResult.browser;
    lock = browserResult.lock;

    const pageResult = await createPageWithRetry(browser, lock);
    context = pageResult.context;
    page = pageResult.page;
    lock = pageResult.lock;

    console.log(`🌐 Navigation vers : ${url}...`);
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });

    // Petit scroll pour simuler un humain et charger le contenu dynamique
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(1500);

    console.log("🔍 Extraction des données...");
    const jobs = await page.evaluate(({ sel, tSel, cSel, lSel }) => {
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
    }, { selector, titleSelector, companySelector, linkSelector });

    console.log(`✅ ${jobs.length} offres trouvées avec Playwright.`);
    return jobs;

  } catch (error) {
    console.error("❌ Erreur lors du scraping navigateur :", error.message);
    return [];
  } finally {
    // OPTIMISATION MÉMOIRE : Fermer le context et libérer le lock, pas le browser
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (lock) releaseBrowser(lock);
  }
}
