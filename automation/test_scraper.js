import { scrapeJobs } from './scraper.js';

async function runTest() {
  console.log("🚀 Début du test de scraping sur le Mock Site local...");
  
  const url = 'http://localhost:4174/';
  
  const jobs = await scrapeJobs(
    url, 
    '.job-card',
    '.titleline > a',
    '.company',
    'a'
  );

  if (jobs.length > 0) {
    console.log("✨ TEST RÉUSSI ! Voici un échantillon :");
    console.log(jobs[0]);
  } else {
    console.log("❌ TEST ÉCHOUÉ : Aucune donnée récupérée.");
  }
}

runTest();
