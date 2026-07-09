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
    jobsList.innerHTML = `<p class="text-gray-500 text-center p-4">Aucune candidature enregistrée.</p>`;
    return;
  }

  jobsList.innerHTML = jobs.map(job => `
    <div class="bg-white rounded-lg shadow-md p-6 border-l-4 ${job.score > 70 ? 'border-green-500' : 'border-orange-400'}">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-xl font-bold text-gray-800">${job.title}</h3>
          <p class="text-gray-600 font-medium">${job.company} - ${job.country}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100">${job.status}</span>
      </div>
      
      <div class="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
        <p>💰 Salaire: <span class="font-semibold">${job.salary}</span></p>
        <p>📝 Contrat: <span class="font-semibold">${job.contract_type}</span></p>
        <p>📅 Posté le: <span class="font-semibold">${job.date_posted}</span></p>
        <p>🎯 Score IA: <span class="font-bold text-blue-600">${job.score}/100</span></p>
      </div>

      <div class="bg-gray-50 p-3 rounded mb-4 text-sm text-gray-700 italic">
        "${job.analysis}"
      </div>
      
      <div class="flex justify-end gap-2">
        <a href="${job.link}" target="_blank" class="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Voir l'offre</a>
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
  const title = document.getElementById("jobPosition").value;
  const company = document.getElementById("jobCompany").value;
  const link = document.getElementById("jobLink").value;
  const country = document.getElementById("jobCountry").value || "Non spécifié";

  try {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, company, link, country, score: 0, letter: "", analysis: "" })
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
