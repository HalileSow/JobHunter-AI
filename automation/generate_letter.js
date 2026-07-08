import { generateLetter } from './ai_engine.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const [,, offer, cv] = process.argv;

  if (!offer || !cv) {
    console.log("Usage: node generate_letter.js '<texte_offre>' <chemin_vers_cv>");
    process.exit(1);
  }

  const absoluteCvPath = path.resolve(process.cwd(), '..', cv);

  try {
    console.log("L'IA travaille...");
    const text = await generateLetter(offer, absoluteCvPath);

    const outputDir = path.join(__dirname, '../cover_letters/generated');
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `letter_${timestamp}.md`);
    
    await fs.writeFile(outputPath, text);

    console.log("OK: Lettre generee.");
    console.log("File: " + outputPath);
  } catch (error) {
    console.error("Erreur: " + error.message);
  }
}

run();
