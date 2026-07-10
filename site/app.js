async function api(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`/api${endpoint}`, options);
    return response.json();
}

// Tab Management
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        
        if (btn.dataset.tab === 'dashboard') loadJobs();
        if (btn.dataset.tab === 'cvs') loadCvs();
    });
});

// Dashboard: Load Jobs
async function loadJobs() {
    const jobs = await api('/jobs');
    const list = document.getElementById('jobs-list');
    const totalEl = document.getElementById('total-jobs');
    const avgEl = document.getElementById('avg-score');
    
    totalEl.textContent = jobs.length;
    const avg = jobs.length ? Math.round(jobs.reduce((a, b) => a + b.score, 0) / jobs.length) : 0;
    avgEl.textContent = `${avg}%`;
    
    list.innerHTML = jobs.map(job => `
        <div class="job-card">
            <span class="score-badge">${job.score}%</span>
            <h3>${job.title}</h3>
            <span class="company">${job.company}</span>
            <div class="analysis">${job.analysis.substring(0, 150)}...</div>
            <div class="actions">
                <a href="/cover_letters/generated/${job.company.replace(/\s+/g, '_')}_letter_fr.pdf" target="_blank" class="btn-outline">
                    <i class="fas fa-file-pdf"></i> PDF
                </a>
                <button onclick="deleteJob(${job.id})" class="btn-danger">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function deleteJob(id) {
    if (confirm('Supprimer cette offre ?')) {
        await api(`/jobs/${id}`, 'DELETE');
        loadJobs();
    }
}

// Search: Launch Automation
document.getElementById('btn-launch-search').addEventListener('click', async () => {
    const btn = document.getElementById('btn-launch-search');
    const data = {
        country: document.getElementById('search-country').value,
        title: document.getElementById('search-title').value,
        keywords: document.getElementById('search-keywords').value,
        lang: document.getElementById('search-lang').value
    };

    if (!data.title) return alert('Veuillez saisir un titre de métier.');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Automatisation en cours...';
    
    try {
        await api('/search', 'POST', data);
        alert('🚀 Recherche lancée ! Les résultats apparaîtront dans le Dashboard d'ici quelques minutes.');
    } catch (e) {
        alert('Erreur lors du lancement.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Lancer l'Automatisation';
    }
});

// CVS: Load List
async function loadCvs() {
    const cvs = await api('/cvs');
    const list = document.getElementById('cv-list');
    list.innerHTML = cvs.map(cv => `
        <div class="cv-card">
            <div>
                <h3>${cv.name}</h3>
                <p>${cv.path}</p>
            </div>
            <button class="btn-active">Activer</button>
        </div>
    `).join('');
}

// Init
loadJobs();
