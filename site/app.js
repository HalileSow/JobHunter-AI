const input = document.getElementById("photoInput");
const preview = document.getElementById("photoPreview");
const fallback = document.getElementById("photoFallback");
const clearBtn = document.getElementById("clearPhoto");
const offerText = document.getElementById("offerText");
const generateCv = document.getElementById("generateCv");
const resetCv = document.getElementById("resetCv");
const targetTitle = document.getElementById("targetTitle");
const targetSummary = document.getElementById("targetSummary");
const targetKeywords = document.getElementById("targetKeywords");
const storageKey = "jobhunter_profile_photo";

// Nouveaux éléments
const addJobForm = document.getElementById("addJobForm");
const jobsList = document.getElementById("jobsList");
const countTotal = document.getElementById("countTotal");
const countSent = document.getElementById("countSent");
const countReplies = document.getElementById("countReplies");

// --- GESTION PHOTO ---
function showPhoto(dataUrl) {
  preview.src = dataUrl;
  preview.style.display = "block";
  fallback.style.display = "none";
}

function hidePhoto() {
  preview.removeAttribute("src");
  preview.style.display = "none";
  fallback.style.display = "grid";
}

const savedPhoto = localStorage.getItem(storageKey);
if (savedPhoto) {
  showPhoto(savedPhoto);
} else {
  hidePhoto();
}

input.addEventListener("change", () => {
  const file = input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const value = String(reader.result);
    localStorage.setItem(storageKey, value);
    showPhoto(value);
  };
  reader.readAsDataURL(file);
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  input.value = "";
  hidePhoto();
});

// --- GESTION CV ---
const baseProfile = {
  title: "Agent polyvalent",
  summary:
    "Profil polyvalent orienté tâches pratiques, logistique, entretien et service.",
  keywords: ["polyvalent", "logistique", "entretien", "service", "rigueur"],
};

const offerRules = [
  {
    terms: ["warehouse", "stock", "inventory", "entrepot", "entrepôt", "magasin"],
    title: "Aide en entrepôt",
    summary: "Profil orienté préparation de commandes, gestion du stock et manutention légère.",
    keywords: ["stock", "préparation de commandes", "manutention", "organisation"],
  },
  {
    terms: ["cleaning", "housekeeping", "nettoyage", "cleaner", "entretien"],
    title: "Agent de nettoyage",
    summary: "Profil orienté entretien des espaces, respect des consignes et travail soigné.",
    keywords: ["nettoyage", "entretien", "hygiene", "soin", "discipline"],
  },
  {
    terms: ["restaurant", "kitchen", "food", "service", "cuisine", "restauration"],
    title: "Aide en restauration",
    summary: "Profil orienté service, aide en cuisine, mise en place et accueil client.",
    keywords: ["service", "cuisine", "accueil", "rapidité", "travail en équipe"],
  },
  {
    terms: ["farm", "agriculture", "agricole", "harvest", "field"],
    title: "Aide agricole",
    summary: "Profil orienté travaux manuels, respect des consignes et effort physique.",
    keywords: ["agriculture", "travail manuel", "consignes", "endurance"],
  },
  {
    terms: ["logistics", "delivery", "transport", "logistique", "shipping"],
    title: "Agent logistique",
    summary: "Profil orienté circulation des marchandises, contrôle et suivi opérationnel.",
    keywords: ["logistique", "suivi", "contrôle", "organisation", "transport"],
  },
];

function renderKeywords(items) {
  targetKeywords.innerHTML = "";
  items.forEach((item) => {
    const tag = document.createElement("span");
    tag.textContent = item;
    targetKeywords.appendChild(tag);
  });
}

function renderBaseProfile() {
  targetTitle.textContent = baseProfile.title;
  targetSummary.textContent = baseProfile.summary;
  renderKeywords(baseProfile.keywords);
}

function normalize(text) {
  return text.toLowerCase();
}

generateCv.addEventListener("click", () => {
  const text = normalize(offerText.value || "");
  if (!text.trim()) {
    renderBaseProfile();
    return;
  }

  const matched = offerRules.find((rule) =>
    rule.terms.some((term) => text.includes(term))
  );

  if (!matched) {
    targetTitle.textContent = "Agent polyvalent";
    targetSummary.textContent =
      "Profil polyvalent orienté tâches pratiques, logistique, entretien et service.";
    renderKeywords(["polyvalent", "adaptation", "service", "rigueur"]);
    return;
  }

  targetTitle.textContent = matched.title;
  targetSummary.textContent = matched.summary;
  renderKeywords(matched.keywords);
});

resetCv.addEventListener("click", () => {
  offerText.value = "";
  renderBaseProfile();
});

// --- GESTION JOBS (API) ---
async function fetchJobs() {
  try {
    const res = await fetch("/api/jobs");
    if (!res.ok) throw new Error("Failed to fetch");
    const jobs = await res.json();
    renderJobs(jobs);
    updateCounters(jobs);
  } catch (err) {
    console.error("Error loading jobs:", err);
    jobsList.innerHTML = `<p class="error">Erreur lors du chargement des données.</p>`;
  }
}

function renderJobs(jobs) {
  if (jobs.length === 0) {
    jobsList.innerHTML = `<p class="empty-msg">Aucune candidature enregistrée.</p>`;
    return;
  }

  jobsList.innerHTML = jobs.map(job => `
    <div class="job-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
      <div class="job-info">
        <strong>${job.entreprise}</strong><br>
        <small>${job.poste}</small>
      </div>
      <div class="job-meta" style="text-align: right; font-size: 0.8em;">
        <div class="status" style="font-weight: bold;">${job.statut}</div>
        <a href="${job.lien}" target="_blank" style="color: blue;">Lien</a><br>
        <span>${job.date}</span>
      </div>
    </div>
  `).join("");
}

function updateCounters(jobs) {
  if (countTotal) countTotal.textContent = jobs.length;
  if (countSent) countSent.textContent = jobs.filter(j => j.statut === "Postulé").length;
  if (countReplies) countReplies.textContent = jobs.filter(j => j.statut === "Réponse").length;
}

addJobForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const entreprise = document.getElementById("jobCompany").value;
  const poste = document.getElementById("jobPosition").value;
  const lien = document.getElementById("jobLink").value;

  try {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entreprise, poste, lien })
    });

    if (res.ok) {
      addJobForm.reset();
      await fetchJobs();
    } else {
      alert("Erreur lors de l'ajout.");
    }
  } catch (err) {
    console.error("Error adding job:", err);
    alert("Erreur de connexion au serveur.");
  }
});

// --- INITIALISATION ---
renderBaseProfile();
fetchJobs();
