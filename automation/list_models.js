import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config({ path: path.join(process.cwd(), '../.env') });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("ERREUR : GEMINI_API_KEY manquante.");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // Note: The SDK doesn't have a direct listModels method in the high-level API 
    // like the REST API does, so we'll try to use the generative model call 
    // to see if we can get any info, or just try common names.
    // Actually, we can use a simple fetch to the REST endpoint to list models.
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.models) {
      console.log("Modèles disponibles :");
      data.models.forEach(m => console.log(`- ${m.name}`));
    } else {
      console.log("Aucun modèle trouvé ou erreur :", data);
    }
  } catch (error) {
    console.error("Erreur lors de la liste des modèles :", error.message);
  }
}

listModels();
