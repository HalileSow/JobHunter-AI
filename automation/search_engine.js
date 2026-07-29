import crypto from 'crypto';
import { defaultRegistry } from './providers/registry.js';
import { analyzeJob, selectBestCv } from './ai_engine.js';
import { getAllCvs } from './cv_manager.js';
import { exportLetterToPdf } from './pdf_exporter.js';
import { sendJobNotification } from './notifications.js';
import { initDb } from './db.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Normalise une chaîne de texte pour la comparaison (lowercase, suppression accents/ponctuation).
 */
export function normalizeText(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

/**
 * Normalise une URL d'offre (suppression des paramètres tracking utm, trailing slashes, etc.).
 */
export function normalizeUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
        const u = new URL(rawUrl);
        u.hash = '';
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
        trackingParams.forEach(p => u.searchParams.delete(p));
        let clean = u.toString();
        if (clean.endsWith('/')) clean = clean.slice(0, -1);
        return clean;
    } catch (e) {
        return rawUrl.trim();
    }
}

/**
 * Calcule une empreinte numérique (hash) unique pour détecter les doublons.
 */
export function computeDedupHash(job) {
    const canonicalCompany = normalizeText(job.company);
    const canonicalTitle = normalizeText(job.title);
    const canonicalLocation = normalizeText(job.location || job.country || '');
    
    const compositeString = `${canonicalCompany}|${canonicalTitle}|${canonicalLocation}`;
    return crypto.createHash('sha256').update(compositeString).digest('hex');
}

/**
 * Supprime les doublons d'une liste d'offres en fusionnant les métadonnées et sources.
 */
export function deduplicateJobs(jobs) {
    const seenHashes = new Map();
    const seenUrls = new Set();
    const deduplicated = [];

    for (const job of jobs) {
        const cleanUrl = normalizeUrl(job.link);
        const hash = computeDedupHash(job);

        // Si l'URL exacte a déjà été vue, passer
        if (seenUrls.has(cleanUrl)) continue;

        if (seenHashes.has(hash)) {
            // Offre similaire déjà détectée : fusionner les sources de providers
            const existing = seenHashes.get(hash);
            if (!existing.providers_list) {
                existing.providers_list = [existing.provider_name || existing.provider];
            }
            const newSource = job.provider_name || job.provider;
            if (newSource && !existing.providers_list.includes(newSource)) {
                existing.providers_list.push(newSource);
            }
            // Compléter la description si plus riche
            if ((!existing.description || existing.description.length < 50) && job.description) {
                existing.description = job.description;
            }
        } else {
            // Nouvelle offre unique
            job.dedup_hash = hash;
            job.clean_link = cleanUrl;
            job.providers_list = [job.provider_name || job.provider || 'générique'];
            seenHashes.set(hash, job);
            seenUrls.add(cleanUrl);
            deduplicated.push(job);
        }
    }

    return deduplicated;
}

/**
 * Exécute la recherche multi-providers en parallèle et retourne la liste dédoublonnée.
 */
export async function executeMultiProviderSearch({ country, jobTitle, keywords = '', selectedProviderIds = [], limit = 30 }) {
    let providersToUse = [];

    if (selectedProviderIds && selectedProviderIds.length > 0) {
        providersToUse = selectedProviderIds
            .map(id => defaultRegistry.get(id))
            .filter(p => p && p.enabled);
    } else {
        providersToUse = defaultRegistry.getEnabledForCountry(country);
    }

    if (providersToUse.length === 0) {
        console.warn(`⚠️ Aucun provider actif pour le pays "${country}". Utilisation de tous les providers par défaut.`);
        providersToUse = defaultRegistry.getAll().filter(p => p.enabled);
    }

    console.log(`🌐 Recherche en parallèle sur ${providersToUse.length} provider(s) : ${providersToUse.map(p => p.name).join(', ')}...`);

    // Timeout de sécurité par provider (30s)
    const timeoutMs = 30000;

    const providerPromises = providersToUse.map(provider => {
        return Promise.race([
            provider.searchJobs({ country, jobTitle, keywords, limit }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout provider ${provider.name}`)), timeoutMs))
        ]).catch(err => {
            console.error(`❌ Échec ou timeout sur ${provider.name} : ${err.message}`);
            return [];
        });
    });

    const resultsArray = await Promise.all(providerPromises);
    const rawJobs = resultsArray.flat();

    console.log(`📊 Brut d'offres récupérées : ${rawJobs.length}`);

    // Dédoublonnage intelligent
    const uniqueJobs = deduplicateJobs(rawJobs);
    console.log(`✨ Après dédoublonnage intelligent : ${uniqueJobs.length} offre(s) uniques.`);

    return uniqueJobs;
}

/**
 * Moteur complet : Recherche multi-providers, dédoublonnage, sélection du CV, scoring IA,
 * génération de la lettre de motivation PDF, et enregistrement en base de données.
 */
export async function runFullJobHunterSearch({ country, jobTitle, keywords = '', lang = 'fr', selectedProviderIds = [] }) {
    const db = await initDb();

    // 1. Démarrer la recherche multi-providers
    const uniqueJobs = await executeMultiProviderSearch({ country, jobTitle, keywords, selectedProviderIds });

    if (uniqueJobs.length === 0) {
        console.log(`ℹ️ Aucune nouvelle offre trouvée pour ${jobTitle} en ${country}.`);
        return { jobsFound: 0, jobsSaved: 0, jobs: [] };
    }

    // 2. Charger les CVs disponibles
    const allCvs = await getAllCvs();
    if (allCvs.length === 0) {
        throw new Error("Aucun CV disponible dans la base de données.");
    }

    const cvsWithContent = await Promise.all(allCvs.map(async cv => {
        const content = await fs.readFile(cv.path, 'utf-8');
        return { ...cv, content };
    }));

    const processedJobs = [];

    // 3. Traitement et classification par IA
    for (const job of uniqueJobs) {
        // Vérifier si ce dedup_hash existe déjà en BDD
        const existingInDb = await db('jobs').where({ dedup_hash: job.dedup_hash }).first();
        if (existingInDb) {
            console.log(`⏩ Offre déjà existante en BDD : ${job.title} chez ${job.company}`);
            processedJobs.push(existingInDb);
            continue;
        }

        console.log(`📝 Analyse & Scoring IA pour : ${job.title} chez ${job.company}`);
        const offerText = `Titre: ${job.title}\nEntreprise: ${job.company}\nLieu: ${job.location || country}\nLien: ${job.link}\nSources: ${(job.providers_list || []).join(', ')}\nDescription: ${job.description || 'Description non fournie.'}`;

        try {
            // A. Sélection du CV idéal
            const bestCvId = await selectBestCv(offerText, cvsWithContent);
            const selectedCv = cvsWithContent.find(c => c.id === bestCvId) || cvsWithContent[0];

            // B. Scoring et rédaction de la lettre
            const aiResult = await analyzeJob(offerText, selectedCv.path, lang);

            // C. Export PDF de la lettre de motivation
            const safeCompany = (job.company || 'Entreprise').replace(/[^a-zA-Z0-9_-]/g, '_');
            const pdfFilename = `${safeCompany}_${Date.now()}_${lang}.pdf`;
            const pdfPath = path.resolve(__dirname, `../cover_letters/generated/${pdfFilename}`);
            await fs.mkdir(path.dirname(pdfPath), { recursive: true });
            await exportLetterToPdf(aiResult.letter, job.company, pdfPath);

            // D. Déterminer si le provider supporte l'auto-apply
            const providerInstance = defaultRegistry.get(job.provider);
            const isAutoApplySupported = providerInstance ? (providerInstance.supportsAutoApply(job) ? 1 : 0) : 0;

            // E. Sauvegarde en BDD
            const [insertedId] = await db('jobs').insert({
                title: job.title,
                company: job.company,
                link: job.link,
                country: country,
                score: aiResult.score,
                letter: aiResult.letter,
                analysis: aiResult.analysis,
                status: 'Enregistré',
                salary: job.salary || 'N/A',
                contract_type: job.contract_type || 'Non spécifié',
                date_posted: job.date_posted || new Date().toISOString().split('T')[0],
                selected_cv_id: selectedCv.id,
                pdf_path: pdfPath,
                provider: job.provider || 'generic',
                dedup_hash: job.dedup_hash,
                auto_apply_supported: isAutoApplySupported
            }).returning('id');

            const insertedJob = await db('jobs').where({ id: insertedId.id || insertedId }).first();
            processedJobs.push(insertedJob);

            // Envoyer notification si l'offre est pertinente (score > 70 par exemple)
            if (insertedJob.score > 70) {
                await sendJobNotification(insertedJob);
            }

            console.log(`💾 Offre enregistrée (ID: ${insertedJob.id}) | Score: ${insertedJob.score}/100 | AutoApply: ${isAutoApplySupported ? 'Oui' : 'Non'}`);
        } catch (err) {
            console.error(`❌ Erreur traitement IA pour ${job.company}:`, err.message);
        }
    }

    // Trier les offres par score décroissant
    processedJobs.sort((a, b) => (b.score || 0) - (a.score || 0));

    return {
        jobsFound: uniqueJobs.length,
        jobsSaved: processedJobs.length,
        jobs: processedJobs
    };
}
