import { scrapeJobs } from './scraper.js';
import { generateLetter } from './ai_engine.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    console.log("🚀 Lancement de l'automatisation complète...");
    
    // Configuration cible (exemple: un site fictif pour test, à remplacer par de vraies cibles)
    const targetUrl = 'http://localhost:4174/';
    const selector = '.job-card';
    const titleSel = '.titleline > a';
    const compSel = '.company';
    const linkSel = 'a';
    const cvPath = path.resolve(process.cwd(), '../cv/fr/cv.txt'); // Assurez-vous que ce fichier existe

    try {
        // 1. Scraping
        const jobs = await scrapeJobs(targetUrl, selector, titleSel, compSel, linkSel);
        
        if (jobs.length === 0) {
            console.log("Aucune offre trouvée.");
            return;
        }

        // 2. Traitement IA pour chaque offre
        for (const job of jobs) {
            console.log(`📝 Traitement de l'offre : ${job.title} chez ${job.company}`);
            
            const offerText = `Titre: ${job.title}\nEntreprise: ${job.company}\nLien: ${job.link}`;
            
            try {
                const letter = await generateLetter(offerText, cvPath);
                console.log("✅ Lettre générée avec succès.");
                
                // 3. Sauvegarde de la lettre (simulant le dépôt)
                const savePath = path.resolve(process.cwd(), `../cover_letters/generated/${job.company.replace(/\s+/g, '_')}_letter.txt`);
                await fs.writeFile(savePath, letter);
                console.log(`💾 Lettre sauvegardée dans : ${savePath}`);
            } catch (err) {
                console.error(`❌ Erreur IA pour ${job.company}:`, err.message);
            }
        }
        console.log("✨ Automatisation terminée.");
    } catch (error) {
        console.error("❌ Erreur critique dans le workflow :", error.message);
    }
}

main();
