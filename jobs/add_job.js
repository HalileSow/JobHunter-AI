import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../database/jobs_db.json');

async function addJob(entreprise, poste, lien, notes = "") {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    const jobs = JSON.parse(data);

    const newJob = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      entreprise,
      poste,
      statut: "Postulé",
      lien,
      notes
    };

    jobs.push(newJob);
    await fs.writeFile(DB_PATH, JSON.stringify(jobs, null, 2));
    console.log(`✅ Job ajouté avec succès : ${poste} chez ${entreprise}`);
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout du job :", error.message);
  }
}

const [,, ent, pos, ln, nt] = process.argv;

if (!ent || !pos) {
  console.log("Usage: node add_job.js <entreprise> <poste> <lien> [notes]");
  process.exit(1);
}

addJob(ent, pos, ln || "", nt || "");
