import { scrapeJobs } from './scraper.js';
import { analyzeJob } from './ai_engine.js';
import { initDb } from './db.js';
import { getActiveCvPath } from './cv_manager.js';
import { exportLetterToPdf } from './pdf_exporter.js';
import fs from 'fs/promises';
import path from 'path';

async function loadConfig() {
    const configPath = path.resolve(process.cwd(), '../config/search_config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
}


async function runSearch(country, jobTitle, keywords, lang = 'fr') {
    const config = await loadConfig();
    const cvPath = await getActiveCvPath();
    const db = await initDb();
    
    if (!cvPath) {
        throw new Error("Aucun CV actif sélectionné.");
    }

    console.log(`🚀 Démarrage JobHunter-AI pour : ${jobTitle} en ${country} (Langue: ${lang})`);
    
    let allJobs = [];
    
    for (const providerName of config.search.default_providers) {
        try {
            const provider = await import(`./providers/${providerName}.js`);
            const jobs = await provider.searchJobs(country, jobTitle, keywords);
            allJobs = allJobs.concat(jobs);
        } catch (err) {
            console.error(`❌ Erreur provider ${providerName}:`, err.message);
        }
    }
    
    console.log(`✅ Total trouvé : ${allJobs.length} offres.`);
    
    // Traitement par IA et stockage SQLite
    for (const job of allJobs) {
        console.log(`📝 Analyse : ${job.title} chez ${job.company}`);
        const offerText = `Titre: ${job.title}\nEntreprise: ${job.company}\nLien: ${job.link}`;
        
        try {
            const result = await analyzeJob(offerText, cvPath, lang);
            console.log(`📊 Score : ${result.score}/100`);
            
            // Sauvegarde SQLite
            await db.run(
                'INSERT INTO jobs (title, company, link, country, score, letter, analysis, salary, contract_type, date_posted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [job.title, job.company, job.link, country, result.score, result.letter, result.analysis, job.salary, job.contract_type, job.date_posted]
            );
            
            // Export PDF
            const filename = `${job.company.replace(/\s+/g, '_')}_letter_${lang}.pdf`;
            const pdfPath = path.resolve(process.cwd(), `../cover_letters/generated/${filename}`);
            await exportLetterToPdf(result.letter, job.company, pdfPath);
            
            console.log(`💾 Candidature et PDF prêts : ${pdfPath}`);
        } catch (err) {
            console.error(`❌ Erreur IA pour ${job.company}:`, err.message);
        }
    }
    await db.close();
}

const [,, country, title, keywords, lang] = process.argv;
if (country && title) {
    runSearch(country, title, keywords || "", lang || 'fr');
} else {
    console.log("Usage: node main.js <Pays> <Métier> <Mots-clés> [lang: fr|en|de]");
}
