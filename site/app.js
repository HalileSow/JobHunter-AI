async function api(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`/api${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
    return data;
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
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
        if (btn.dataset.tab === 'settings') loadProfile();
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
    
    list.innerHTML = jobs.length ? jobs.map(job => `
        <div class="job-card">
            <span class="score-badge">${job.score}%</span>
            <h3>${escapeHtml(job.title)}</h3>
            <span class="company">${escapeHtml(job.company)}</span>
            <div class="analysis">${escapeHtml((job.analysis || 'Analyse indisponible.').substring(0, 150))}...</div>
            <div class="actions">
                <a href="/api/jobs/${job.id}/pdf" target="_blank" class="btn-outline">
                    <i class="fas fa-file-pdf"></i> PDF
                </a>
                <button onclick="deleteJob(${job.id})" class="btn-danger">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('') : '<p class="empty-state">Aucune offre analysée pour le moment.</p>';
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
        alert("Recherche lancée. Les résultats apparaîtront dans le tableau de bord dès la fin du traitement.");
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Lancer l’Automatisation';
    }
});

// CVS: Load List
async function loadCvs() {
    const cvs = await api('/cvs');
    const list = document.getElementById('cv-list');
    list.innerHTML = cvs.length ? cvs.map(cv => `
        <div class="cv-card">
            <div>
                <h3>${escapeHtml(cv.name)}</h3>
                <p>${cv.is_active ? 'CV actif' : 'CV disponible'}</p>
            </div>
            <button onclick="activateCv(${cv.id})" class="btn-active" ${cv.is_active ? 'disabled' : ''}>${cv.is_active ? 'Actif' : 'Activer'}</button>
        </div>
    `).join('') : '<p class="empty-state">Aucun CV enregistré.</p>';
}

async function activateCv(id) {
    try {
        await api(`/cvs/${id}/active`, 'PUT');
        await loadCvs();
    } catch (error) {
        alert(error.message);
    }
}

function setProfileValue(id, value = '') {
    document.getElementById(id).value = value || '';
}

async function loadProfile() {
    try {
        const profile = await api('/profile');
        setProfileValue('profile-first-name', profile.first_name);
        setProfileValue('profile-last-name', profile.last_name);
        setProfileValue('profile-email', profile.email);
        setProfileValue('profile-phone', profile.phone);
        setProfileValue('profile-address', profile.address);
        setProfileValue('profile-nationality', profile.nationality);
        setProfileValue('profile-availability', profile.availability);
        setProfileValue('profile-skills', Array.isArray(profile.skills) ? profile.skills.join(', ') : JSON.parse(profile.skills || '[]').join(', '));
        setProfileValue('profile-experience', profile.experience);
        setProfileValue('profile-education', profile.education);
    } catch (error) {
        document.getElementById('profile-feedback').textContent = error.message;
    }
}

document.getElementById('profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = document.getElementById('profile-feedback');
    const skills = document.getElementById('profile-skills').value.split(',').map((skill) => skill.trim()).filter(Boolean);
    const profile = {
        first_name: document.getElementById('profile-first-name').value,
        last_name: document.getElementById('profile-last-name').value,
        email: document.getElementById('profile-email').value,
        phone: document.getElementById('profile-phone').value,
        address: document.getElementById('profile-address').value,
        nationality: document.getElementById('profile-nationality').value,
        availability: document.getElementById('profile-availability').value,
        skills,
        experience: document.getElementById('profile-experience').value,
        education: document.getElementById('profile-education').value
    };
    try {
        await api('/profile', 'PUT', profile);
        feedback.textContent = 'Profil enregistré.';
    } catch (error) {
        feedback.textContent = error.message;
    }
});

// Init
loadJobs();
