import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Helper pour appeler Gemini
 */
async function callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY manquante");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * Helper pour appeler OpenAI
 */
async function callOpenAI(prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY manquante");
    
    const openai = new OpenAI({ apiKey });
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
 * Analyse une offre et génère une candidature avec fallback multi-IA et simulation.
 * @param {string} offerText - Texte de l'offre
 * @param {string} cvPath - Chemin vers le CV
 * @param {string} lang - Langue (fr, en, de)
 * @returns {Promise<Object>} - { score, letter, analysis }
 */
export async function analyzeJob(offerText, cvPath, lang = 'fr') {
    const cvContent = await fs.readFile(cvPath, 'utf-8');
    const langName = lang === 'fr' ? 'français' : lang === 'en' ? 'anglais' : 'allemand';
    
    const prompt = `Tu es un expert en recrutement.
À partir du CV suivant :
---
${cvContent}
---
Et de l'offre d'emploi suivante :
---
${offerText}
---
Rédige une lettre de motivation convaincante en ${langName}.
Réponds UNIQUEMENT en JSON avec la structure suivante :
{
  "score": <score de 0 à 100>,
  "letter": "<lettre de motivation convaincante, max 300 mots>",
  "analysis": "<analyse des points forts et des lacunes par rapport au CV>"
}`;

    try {
        console.log("🤖 Tentative avec Gemini...");
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
