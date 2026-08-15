import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AI_TIMEOUT_MS = 60000;

/**
 * Helper pour appeler Gemini
 */
export async function callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY manquante");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini request timed out')), AI_TIMEOUT_MS))
    ]);
    const text = result.response.text();
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * Helper pour appeler Qwen via l'API compatible OpenAI
 */
export async function callQwen(prompt) {
    const apiKey = process.env.QWEN_API_KEY;
    const baseUrl = process.env.QWEN_BASE_URL;
    if (!apiKey) throw new Error("QWEN_API_KEY manquante");
    if (!baseUrl) throw new Error("QWEN_BASE_URL manquante");

    const openai = new OpenAI({ apiKey, baseURL: baseUrl, timeout: AI_TIMEOUT_MS });
    const response = await openai.chat.completions.create({
        model: process.env.QWEN_MODEL || "qwen-plus",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
    });
    return response.choices[0].message.content;
}

/**
 * Helper pour appeler OpenAI
 */
async function callOpenAI(prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY manquante");

    const openai = new OpenAI({ apiKey, timeout: AI_TIMEOUT_MS });
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
    });
    return response.choices[0].message.content;
}

/**
 * Génère une réponse fictive pour ne pas bloquer le développement
 */
function simulateAnalysis() {
    return JSON.stringify({
        score: Math.floor(Math.random() * 40) + 60,
        letter: "Ceci est une lettre de motivation simulée car les API IA sont indisponibles. Le candidat possède les compétences requises pour le poste...",
        analysis: "Simulation : Points forts : Expérience technique. Points faibles : Langues."
    });
}

/**
 * Sélectionne le meilleur CV parmi une liste en fonction de l'offre.
 * @param {string} offerText - Texte de l'offre
 * @param {Array} cvs - Liste des CV [{id, name, content}, ...]
 * @returns {Promise<number>} - L'ID du meilleur CV
 */
export async function selectBestCv(offerText, cvs) {
    if (cvs.length === 1) return cvs[0].id;

    const cvSummaries = cvs.map(cv => `ID ${cv.id} (${cv.name}): ${cv.content.substring(0, 500)}...`).join('\\n\\n');
    
    const prompt = `Tu es un expert en recrutement.
Voici une offre d'emploi :
---
${offerText}
---
Et voici plusieurs versions d'un CV pour le même candidat :
---
${cvSummaries}
---
Lequel de ces CV est le plus adapté pour postuler à cette offre ? 
Réponds UNIQUEMENT avec l'ID du CV choisi (un nombre).`;

    try {
        console.log("🤖 IA sélectionne le meilleur CV via Qwen...");
        const idString = await callQwen(prompt);
        return parseInt(idString.trim());
    } catch (err) {
        console.warn(`⚠️ Erreur sélection CV : ${err.message}. Choix par défaut...`);
        return cvs[0].id;
    }
}

/**
 * Analyse une offre et génère une candidature avec fallback multi-IA et simulation.
...
 * @param {string} offerText - Texte de l'offre
 * @param {string} cvPath - Chemin vers le CV
 * @param {string} lang - Langue (fr, en, de)
 * @returns {Promise<Object>} - { score, letter, analysis }
 */
export async function analyzeJob(offerText, cvReference, lang = 'fr') {
    // New callers pass persisted content. Keep accepting a path for legacy
    // CLI callers, but never make the analysis depend on a fixed filename.
    const cvContent = cvReference && typeof cvReference === 'object' && typeof cvReference.content === 'string'
        ? cvReference.content
        : await fs.readFile(cvReference?.path || cvReference, 'utf-8');
    const langName = lang === 'fr' ? 'français' : lang === 'en' ? 'anglais' : 'allemand';

    const prompt = `Tu es un expert en recrutement de haut niveau et un spécialiste en copywriting de carrière.
Ton objectif est d'analyser l'adéquation entre un candidat et une offre d'emploi pour maximiser les chances d'obtenir un entretien.

CONTEXTE :
- CV du candidat : 
---
${cvContent}
---
- Offre d'emploi : 
---
${offerText}
---

CONSIGNES D'ANALYSE :
1. **Scoring (0-100)** : Sois sévère. 100% signifie que le candidat coche absolument toutes les cases. 70% est un très bon profil. En dessous de 50%, le profil est insuffisant.
2. **Analyse Critique** : Identifie précisément les "Hard Skills" manquantes et les "Soft Skills" à mettre en avant.
3. **Lettre de Motivation** : Rédige une lettre percutante en ${langName} en suivant cette structure :
   - **L'Accroche** : Capte l'attention immédiatement en liant un succès du candidat à un besoin de l'entreprise.
   - **La Proposition de Valeur** : Ne liste pas les compétences, prouve-les par des résultats concrets issus du CV.
   - **L'Appel à l'Action (CTA)** : Termine par une demande d'entretien directe et confiante.
   - **Style** : Professionnel, moderne, sans clichés (évite "Je suis dynamique et motivé").

Réponds UNIQUEMENT en JSON avec la structure suivante :
{
  "score": <nombre>,
  "letter": "<lettre de motivation optimisée, max 300 mots>",
  "analysis": "POINTS FORTS : \\n- ...\\n\\nLACUNES : \\n- ...\\n\\nCONSEILS : \\n- ..."
}`;

    try {
        console.log("🤖 Tentative avec Qwen...");
        const jsonString = await callQwen(prompt);
        return JSON.parse(jsonString);
    } catch (qwenErr) {
        console.warn(`⚠️ Qwen a échoué : ${qwenErr.message}. Bascule vers Gemini...`);
        try {
            const jsonString = await callGemini(prompt);
            return JSON.parse(jsonString);
        } catch (err) {
            console.warn(`⚠️ Gemini a échoué : ${err.message}. Bascule vers OpenAI...`);
            try {
                const jsonString = await callOpenAI(prompt);
                return JSON.parse(jsonString);
            } catch (openaiErr) {
                console.warn(`⚠️ OpenAI a aussi échoué : ${openaiErr.message}. Passage en mode simulation...`);
                return JSON.parse(simulateAnalysis());
            }
        }
    }
}

/** Génère uniquement la lettre de motivation pour la commande historique. */
export async function generateLetter(offerText, cvPath, lang = 'fr') {
    const result = await analyzeJob(offerText, cvPath, lang);
    return result.letter;
}
