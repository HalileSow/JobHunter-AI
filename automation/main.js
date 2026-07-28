import { scrapeJobs } from './scraper.js';
import { analyzeJob, selectBestCv } from './ai_engine.js';
import { initDb } from './db.js';
import { getAllCvs, getActiveCvPath } from './cv_manager.js';
import { exportLetterToPdf } from './pdf_exporter.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadConfig() {
    const configPath = path.resolve(__dirname, '../config/search_config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
}


export async function runSearch(country, jobTitle, keywords, lang = 'fr') {
    const config = await loadConfig();
    const db = await initDb();
    
    console.log(`🚀 Démarrage JobHunter-AI pour : ${jobTitle} en ${country} (Langue: ${lang})`);
    
    // Gestion des CV : On récupère tout pour laisser l'IA choisir
    const allCvs = await getAllCvs();
    if (allCvs.length === 0) {
        throw new Error("Aucun CV trouvé dans la base de données.");
    }

    // Chargement du contenu des CV pour l'IA
    const cvsWithContent = await Promise.all(allCvs.map(async cv => {
        const content = await fs.readFile(cv.path, 'utf-8');
        return { ...cv, content };
    }));
    
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
        console.log(`📝 Traitement : ${job.title} chez ${job.company}`);
        const offerText = `Titre: ${job.title}
Entreprise: ${job.company}
Lien: ${job.link}
Description: ${job.description || 'Description non fournie par la source.'}`;
        
        try {
            // 1. Sélection intelligente du CV
            const bestCvId = await selectBestCv(offerText, cvsWithContent);
            const selectedCv = cvsWithContent.find(cv => cv.id === bestCvId) || cvsWithContent[0];
            console.log(`🎯 CV choisi : ${selectedCv.name} (ID: ${bestCvId})`);
            
            // 2. Analyse et génération de la lettre
            const result = await analyzeJob(offerText, selectedCv.path, lang);
            console.log(`📊 Score : ${result.score}/100`);
            
            // Export PDF
            const filename = `${job.company.replace(/\s+/g, '_')}_letter_${lang}.pdf`;
            const pdfPath = path.resolve(__dirname, `../cover_letters/generated/${filename}`);
            await fs.mkdir(path.dirname(pdfPath), { recursive: true });
            await exportLetterToPdf(result.letter, job.company, pdfPath);

            // Sauvegarde SQLite uniquement après la génération réussie du dossier.
            await db('jobs').insert({
                title: job.title,
                company: job.company,
                link: job.link,
                country: country,
                score: result.score,
                letter: result.letter,
                analysis: result.analysis,
                salary: job.salary,
                contract_type: job.contract_type,
                date_posted: job.date_posted,
                selected_cv_id: selectedCv.id,
                pdf_path: pdfPath
            });
            
            console.log(`💾 Candidature et PDF prêts : ${pdfPath}`);
        } catch (err) {
            console.error(`❌ Erreur IA pour ${job.company}:`, err.message);
        }
    }
}

const [,, country, title, keywords, lang] = process.argv;
if (country && title) {
    runSearch(country, title, keywords || "", lang || 'fr').catch((error) => {
        console.error(`❌ Échec du workflow : ${error.message}`);
        process.exitCode = 1;
    });
} else {
    console.log("Usage: node main.js <Pays> <Métier> <Mots-clés> [lang: fr|en|de]");
}
