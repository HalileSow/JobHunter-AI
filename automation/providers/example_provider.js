import { scrapeJobs } from '../scraper.js';

export async function searchJobs(country, jobTitle, keywords) {
    console.log(`🔍 Recherche de ${jobTitle} (${keywords}) en ${country} via ScraperProvider...`);
    
    // Cible le site mock en local
    const url = 'http://localhost:4174/';
    
    return await scrapeJobs(
        url, 
        '.job-card',
        '.titleline > a',
        '.company',
        'a'
    );
}
