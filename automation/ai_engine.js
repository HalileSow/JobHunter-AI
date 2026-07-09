import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

// On charge le .env à la racine du projet
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

/**
 * Analyse une offre et génère une candidature.
 * @param {string} lang - La langue de la lettre (fr, en, de)
 * @returns {Promise<Object>} - { score, letter, analysis }
 */
export async function analyzeJob(offerText, cvPath, lang = 'fr') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquante dans le fichier .env");
  }

  const cvContent = await fs.readFile(cvPath, 'utf-8');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  const prompt = `Tu es un expert en recrutement.
À partir du CV suivant :
---
${cvContent}
---
Et de l'offre d'emploi suivante :
---
${offerText}
---
Rédige une lettre de motivation convaincante en ${lang === 'fr' ? 'français' : lang === 'en' ? 'anglais' : 'allemand'}.
Réponds UNIQUEMENT en JSON avec la structure suivante :
{
  "score": <score de 0 à 100>,
  "letter": "<lettre de motivation convaincante, max 300 mots>",
  "analysis": "<analyse des points forts et des lacunes par rapport au CV>"
}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  // Nettoyage pour extraire le JSON
  const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
}
