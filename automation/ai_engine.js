import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

// On charge le .env à la racine du projet
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

/**
 * Génère une lettre de motivation à partir d'une offre et d'un CV.
 * @param {string} offerText - Le texte de l'offre d'emploi.
 * @param {string} cvPath - Le chemin absolu vers le fichier CV.
 * @returns {Promise<string>} - Le texte de la lettre générée.
 */
export async function generateLetter(offerText, cvPath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquante dans le fichier .env");
  }

  const cvContent = await fs.readFile(cvPath, 'utf-8');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro-latest" });

 // Utilisation de flash pour la rapidité

  const prompt = `Tu es un expert en recrutement. 
À partir du CV suivant :
---
${cvContent}
---
Et de l'offre d'emploi suivante :
---
${offerText}
---
Rédige une lettre de motivation professionnelle, convaincante et personnalisée en français. 
La lettre doit mettre en avant les compétences du candidat qui correspondent précisément aux besoins de l'offre. 
Utilise un ton professionnel et respectueux. 
Ne dépasse pas 300 mots. 
Réponds uniquement avec le texte de la lettre, sans commentaires avant ou après.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return text;

}
