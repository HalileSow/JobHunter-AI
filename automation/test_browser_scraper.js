import { browserScrape } from './browser_scraper.js';

async function runTest() {
  console.log("🚀 Début du test de scraping avec Playwright sur le Mock Site...");
  
  const url = 'http://localhost:4174/';
  
  // Sélecteurs adaptés au Mock Site
  const jobs = await browserScrape(
    url, 
    '.job-card',    // le conteneur
    '.titleline > a', // le titre
    '.company',    // l'entreprise
    'a'            // le lien
  );

  if (jobs.length > 0) {
    console.log("✨ TEST RÉUSSI ! Voici un échantillon :");
    console.log(jobs[0]);
  } else {
    console.log("❌ TEST ÉCHOUÉ : Aucune donnée récupérée.");
  }
}

runTest();
