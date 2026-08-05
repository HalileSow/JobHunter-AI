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
 * Normalise une valeur salariale textuelle en intervalle numérique.
 */
export function parseSalaryRange(value) {
    if (value === undefined || value === null) return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
        return { min: value, max: value };
    }

    const text = String(value)
        .toLowerCase()
        .replace(/(\d)\s+(?=\d)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text || ['n/a', 'na', 'non spécifié', 'non specifie', 'selon profil', 'selon experience', 'non communiqué', 'non communique'].includes(text)) {
        return null;
    }

    const extractNumber = (raw) => {
        const compact = raw.replace(/[^0-9.,kmb]/g, '').replace(',', '.');
        const multiplier = compact.includes('m') ? 1_000_000 : compact.includes('k') ? 1_000 : compact.includes('b') ? 1_000_000_000 : 1;
        const numeric = parseFloat(compact.replace(/[kmb]/g, ''));
        return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null;
    };

    const matches = text.match(/(\d[\d.,]*\s*[kmb]?)/g);
    if (!matches || matches.length === 0) return null;

    const values = matches.map(extractNumber).filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;

    if (values.length === 1) {
        return { min: values[0], max: values[0] };
    }

    return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Vérifie si un salaire d'offre correspond au filtre demandé.
 */
export function matchesSalaryFilter(jobSalary, { salary, minSalary, maxSalary } = {}) {
    const desiredSalary = Number(salary);
    const desiredMin = Number(minSalary);
    const desiredMax = Number(maxSalary);
    const filterMin = Number.isFinite(desiredMin) && desiredMin > 0 ? desiredMin : (Number.isFinite(desiredSalary) && desiredSalary > 0 ? desiredSalary : null);
    const filterMax = Number.isFinite(desiredMax) && desiredMax > 0 ? desiredMax : null;

    if (filterMin === null && filterMax === null) return true;

    const range = parseSalaryRange(jobSalary);
    if (!range) return false;

    if (filterMin !== null && range.max < filterMin) return false;
    if (filterMax !== null && range.min > filterMax) return false;
    return true;
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
 * Filtre les offres selon les critères de recherche avancés.
 * Les critères vides/undefined sont ignorés (pas de filtre).
 */
export function applySearchFilters(jobs, { city, experienceLevel, contractType, remote, jobType, salary, minSalary, maxSalary }) {
    return jobs.filter(job => {
        if (city) {
            const jobCity = (job.city || job.location || '').toLowerCase();
            const searchCity = city.toLowerCase();
            if (!jobCity.includes(searchCity) && searchCity !== 'remote' && searchCity !== 'télétravail') return false;
        }
        if (contractType) {
            const jobContract = (job.contract_type || '').toLowerCase();
            const searchContract = contractType.toLowerCase();
            const contractAliases = {
                'cdi': ['cdi', 'permanent', 'plein temps', 'full-time'],
                'cdd': ['cdd', 'contract', 'temporaire', 'fixed-term', 'fixed term'],
                'stage': ['stage', 'internship', 'stagiaire'],
                'alternance': ['alternance', 'apprenti', 'apprentissage', 'work-study'],
                'freelance': ['freelance', 'indépendant', 'contractor']
            };
            const allowed = contractAliases[searchContract] || [searchContract];
            if (!allowed.some(alias => jobContract.includes(alias))) return false;
        }
        if (remote === 'full_remote') {
            const jobRemote = (job.remote || '').toLowerCase();
            const jobLocation = (job.location || '').toLowerCase();
            const jobTitle = (job.title || '').toLowerCase();
            const isRemote = jobRemote.includes('remote') || jobRemote.includes('full_remote')
                || jobLocation.includes('remote') || jobLocation.includes('télétravail')
                || jobTitle.includes('remote');
            if (!isRemote) return false;
        }
        if (remote === 'on_site') {
            const jobRemote = (job.remote || '').toLowerCase();
            const jobLocation = (job.location || '').toLowerCase();
            const jobTitle = (job.title || '').toLowerCase();
            const isOnSite = jobRemote.includes('on_site')
                || jobRemote.includes('onsite')
                || jobLocation.includes('présentiel')
                || jobLocation.includes('presentiel')
                || jobLocation.includes('on site')
                || jobTitle.includes('on site')
                || jobTitle.includes('présentiel')
                || jobTitle.includes('presentiel');

            if (!isOnSite) return false;
        }
        if (experienceLevel) {
            const jobExp = (job.experience_level || '').toLowerCase();
            const jobDesc = (job.description || '').toLowerCase();
            const jobTitleLower = (job.title || '').toLowerCase();
            const combined = `${jobExp} ${jobDesc} ${jobTitleLower}`;
            const expAliases = {
                'junior': ['junior', '0-2', 'débutant', 'entry', 'entry-level'],
                'mid': ['mid', '2-5', 'confirmé', 'intermediate'],
                'senior': ['senior', '5-10', 'expérimenté', 'senior'],
                'director': ['director', '10+', 'directeur', 'head', 'lead', 'manager']
            };
            const allowed = expAliases[experienceLevel] || [experienceLevel];
            if (!allowed.some(alias => combined.includes(alias))) return false;
        }
        if (jobType) {
            const jobTypeStr = (job.job_type || job.contract_type || '').toLowerCase();
            const typeAliases = {
                'full_time': ['full', 'plein', 'cdi', 'permanent', 'full-time'],
                'part_time': ['part', 'temps partiel', 'mi-temps', 'part-time'],
                'internship': ['stage', 'internship']
            };
            const allowed = typeAliases[jobType] || [jobType];
            if (!allowed.some(alias => jobTypeStr.includes(alias))) return false;
        }
        if (!matchesSalaryFilter(job.salary, { salary, minSalary, maxSalary })) return false;
        return true;
    });
}

/**
 * Exécute la recherche multi-providers en parallèle et retourne la liste dédoublonnée.
 * 
 * OPTIMISATION MÉMOIRE : Les providers sont exécutés séquentiellement (CONCURRENCY_LIMIT = 1)
 * car chaque provider peut lancer une instance Playwright/Chromium qui consomme 150-300 Mo RAM.
 * Sur Render Starter (512 Mo), lancer plusieurs browsers en parallèle provoque un OOM kill.
 */
export async function executeMultiProviderSearch({ country, jobTitle, keywords = '', city = '', experienceLevel = '', contractType = '', remote = '', jobType = '', salary = '', minSalary = '', maxSalary = '', selectedProviderIds = [], limit = 30 }) {
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

    console.log(`🌐 Recherche séquentielle sur ${providersToUse.length} provider(s) : ${providersToUse.map(p => p.name).join(', ')}...`);
    console.log(`📋 Filtres : pays=${country}, ville=${city || '—'}, expérience=${experienceLevel || '—'}, contrat=${contractType || '—'}, remote=${remote || '—'}, type=${jobType || '—'}, salaire=${salary || minSalary || maxSalary || '—'}`);

    const timeoutMs = 30000;

    // OPTIMISATION MÉMOIRE : Exécution séquentielle (1 provider à la fois)
    // pour éviter de lancer plusieurs instances Chromium en parallèle.
    const CONCURRENCY_LIMIT = 1;

    const searchParams = { country, jobTitle, keywords, city, experienceLevel, contractType, remote, jobType, salary, minSalary, maxSalary, limit };

    // Découper les providers en lots de CONCURRENCY_LIMIT maximum
    const executeProviderWithTimeout = (provider) => {
        return Promise.race([
            provider.searchJobs(searchParams),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout provider ${provider.name}`)), timeoutMs))
        ]).catch(err => {
            console.error(`❌ Échec ou timeout sur ${provider.name} : ${err.message}`);
            return [];
        });
    };

    const rawJobs = [];
    for (let i = 0; i < providersToUse.length; i += CONCURRENCY_LIMIT) {
        const batch = providersToUse.slice(i, i + CONCURRENCY_LIMIT);
        console.log(`🔁 Lot ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(providersToUse.length / CONCURRENCY_LIMIT)} : ${batch.map(p => p.name).join(', ')}`);
        const batchResults = await Promise.all(batch.map(executeProviderWithTimeout));
        rawJobs.push(...batchResults.flat());
        
        // Petit délai entre les providers pour laisser le GC récupérer la mémoire
        if (i + CONCURRENCY_LIMIT < providersToUse.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`📊 Brut d'offres récupérées : ${rawJobs.length}`);

    const uniqueJobs = deduplicateJobs(rawJobs);
    console.log(`✨ Après dédoublonnage intelligent : ${uniqueJobs.length} offre(s) uniques.`);

    const filteredJobs = applySearchFilters(uniqueJobs, { city, experienceLevel, contractType, remote, jobType, salary, minSalary, maxSalary });
    if (filteredJobs.length !== uniqueJobs.length) {
        console.log(`🔍 Après filtrage avancé : ${filteredJobs.length} offre(s) correspondent aux critères.`);
    }

    return {
        jobs: filteredJobs,
        rawJobsFound: rawJobs.length,
        uniqueJobsFound: uniqueJobs.length,
        filteredJobsFound: filteredJobs.length,
        providersUsed: providersToUse.map((provider) => provider.id)
    };
}

/**
 * Moteur complet : Recherche multi-providers, dédoublonnage, sélection du CV, scoring IA,
 * génération de la lettre de motivation PDF, et enregistrement en base de données.
 */
export async function runFullJobHunterSearch({ country, jobTitle, keywords = '', city = '', experienceLevel = '', contractType = '', remote = '', jobType = '', salary = '', minSalary = '', maxSalary = '', lang = 'fr', selectedProviderIds = [] }) {
    const db = await initDb();

    // 1. Démarrer la recherche multi-providers avec filtres avancés
    const searchResult = await executeMultiProviderSearch({ country, jobTitle, keywords, city, experienceLevel, contractType, remote, jobType, salary, minSalary, maxSalary, selectedProviderIds });
    const uniqueJobs = searchResult.jobs;

    if (uniqueJobs.length === 0) {
        console.log(`ℹ️ Aucune nouvelle offre trouvée pour ${jobTitle} en ${country}.`);
        return {
            rawJobsFound: searchResult.rawJobsFound || 0,
            uniqueJobsFound: searchResult.uniqueJobsFound || 0,
            jobsAnalyzed: 0,
            jobsFound: 0,
            jobsSaved: 0,
            duplicateJobsSkipped: 0,
            jobs: []
        };
    }

    // 2. Charger les CVs disponibles (optionnel)
    // OPTIMISATION MÉMOIRE : Limiter à 2 CVs max pour éviter de saturer la RAM
    const MAX_CVS_IN_MEMORY = 2;
    const allCvs = await getAllCvs();
    let cvsWithContent = [];

    if (allCvs.length === 0) {
        console.log(`⚠️ Aucun CV disponible dans la base de données. Les offres seront sauvegardées avec un score par défaut.`);
    } else {
        // Ne charger que les MAX_CVS_IN_MEMORY premiers CVs actifs
        const cvsToLoad = allCvs.slice(0, MAX_CVS_IN_MEMORY);
        cvsWithContent = await Promise.all(cvsToLoad.map(async cv => {
            const content = await fs.readFile(cv.path, 'utf-8');
            return { ...cv, content };
        }));
        if (allCvs.length > MAX_CVS_IN_MEMORY) {
            console.log(`⚠️ ${allCvs.length} CVs trouvés, seulement ${MAX_CVS_IN_MEMORY} chargés en mémoire (optimisation RAM).`);
        }
    }

    const processedJobs = [];
    let analyzedCount = 0;
    let duplicateJobsSkipped = 0;

    // Limiter le nombre d'offres traitées par l'IA pour éviter
    // l'épuisement mémoire. Au-delà, les offres sont sauvegardées
    // avec un score par défaut sans analyse IA.
    const MAX_AI_ANALYSIS = 15;
    let aiAnalysisCount = 0;

    // 3. Traitement et classification par IA
    for (const job of uniqueJobs) {
        // Vérifier si ce dedup_hash existe déjà en BDD
        const existingInDb = await db('jobs').where({ dedup_hash: job.dedup_hash }).first();
        if (existingInDb) {
            console.log(`⏩ Offre déjà existante en BDD : ${job.title} chez ${job.company}`);
            duplicateJobsSkipped += 1;
            analyzedCount += 1; // Compter comme analysée (déjà en BDD)
            processedJobs.push(existingInDb);
            continue;
        }

        // Limiter les analyses IA coûteuses en mémoire (max 15 analyses par run)
        const skipAiAnalysis = aiAnalysisCount >= MAX_AI_ANALYSIS && cvsWithContent.length > 0;
        if (skipAiAnalysis) {
            console.log(`⏩ Limite d'analyses IA atteinte (${MAX_AI_ANALYSIS}), score par défaut pour : ${job.title} chez ${job.company}`);
        } else {
            aiAnalysisCount++;
            console.log(`📝 Analyse & Scoring IA pour : ${job.title} chez ${job.company}`);
        }
        const offerText = `Titre: ${job.title}\nEntreprise: ${job.company}\nLieu: ${job.location || country}\nLien: ${job.link}\nSources: ${(job.providers_list || []).join(', ')}\nDescription: ${job.description || 'Description non fournie.'}`;

        try {
            analyzedCount += 1;
            
            let aiResult;
            let selectedCv = null;
            let pdfPath = null;
            
            // Si aucun CV disponible, utiliser un score par défaut
            if (cvsWithContent.length === 0 || skipAiAnalysis) {
                aiResult = {
                    score: 50,
                    letter: skipAiAnalysis
                        ? 'Analyse IA non réalisée (limite mémoire atteinte).'
                        : 'Lettre de motivation non générée (aucun CV disponible).',
                    analysis: skipAiAnalysis
                        ? 'Analyse différée par manque de ressources.'
                        : 'Analyse simplifiée sans CV de référence.'
                };
            } else {
                // A. Sélection du CV idéal
                const bestCvId = await selectBestCv(offerText, cvsWithContent);
                selectedCv = cvsWithContent.find(c => c.id === bestCvId) || cvsWithContent[0];

                // B. Scoring et rédaction de la lettre
                aiResult = await analyzeJob(offerText, selectedCv.path, lang);

                // C. Export PDF de la lettre de motivation
                const safeCompany = (job.company || 'Entreprise').replace(/[^a-zA-Z0-9_-]/g, '_');
                const pdfFilename = `${safeCompany}_${Date.now()}_${lang}.pdf`;
                pdfPath = path.resolve(__dirname, `../cover_letters/generated/${pdfFilename}`);
                await fs.mkdir(path.dirname(pdfPath), { recursive: true });
                await exportLetterToPdf(aiResult.letter, job.company, pdfPath);
            }

            // D. Déterminer si le provider supporte l'auto-apply
            const providerInstance = defaultRegistry.get(job.provider);
            const isAutoApplySupported = providerInstance ? (providerInstance.supportsAutoApply(job) ? 1 : 0) : 0;

            // E. Sauvegarde en BDD avec les champs avancés
            const [insertedId] = await db('jobs').insert({
                title: job.title,
                company: job.company,
                link: job.link,
                country: country,
                city: job.city || city || '',
                score: aiResult.score,
                letter: aiResult.letter,
                analysis: aiResult.analysis,
                status: 'Enregistré',
                salary: job.salary || 'N/A',
                contract_type: job.contract_type || contractType || 'Non spécifié',
                experience_level: job.experience_level || experienceLevel || '',
                remote: job.remote || remote || '',
                job_type: job.job_type || jobType || '',
                search_city: city || '',
                search_experience_level: experienceLevel || '',
                search_remote: remote || '',
                search_contract_type: contractType || '',
                search_salary: salary || '',
                search_min_salary: minSalary || '',
                search_max_salary: maxSalary || '',
                date_posted: job.date_posted || new Date().toISOString().split('T')[0],
                selected_cv_id: selectedCv?.id || null,
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
        rawJobsFound: searchResult.rawJobsFound || 0,
        uniqueJobsFound: searchResult.uniqueJobsFound || uniqueJobs.length,
        jobsAnalyzed: analyzedCount,
        jobsFound: uniqueJobs.length,
        jobsSaved: processedJobs.length,
        duplicateJobsSkipped,
        jobs: processedJobs
    };
}
