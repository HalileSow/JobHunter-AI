async function api(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('jwt_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    let response;
    try {
        response = await fetch(`/api${endpoint}`, options);
    } catch (networkError) {
        console.error(`NetworkError pour ${endpoint}:`, networkError);
        throw new Error('Erreur réseau. Vérifiez votre connexion.');
    }

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = { error: text || `Erreur HTTP ${response.status}` };
    }

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('jwt_token');
        showAuthScreen();
        throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
    return data;
}

// === AUTHENTIFICATION ===
let authMode = 'login';

function showAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    const appContainer = document.getElementById('app-container');
    if (authScreen) authScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

function hideAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    const appContainer = document.getElementById('app-container');
    if (authScreen) authScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
}

function initAuth() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        hideAuthScreen();
        initApp();
    } else {
        showAuthScreen();
    }

    const authForm = document.getElementById('auth-form');
    const authToggle = document.getElementById('auth-toggle');
    const authTitle = document.getElementById('auth-title');
    const authSubmit = document.getElementById('auth-submit');
    const authNameGroup = document.getElementById('auth-name-group');
    const authToggleText = document.getElementById('auth-toggle-text');

    if (authToggle) {
        authToggle.addEventListener('click', (e) => {
            e.preventDefault();
            authMode = authMode === 'login' ? 'register' : 'login';
            const feedback = document.getElementById('auth-feedback');
            if (feedback) feedback.textContent = '';
            if (authMode === 'register') {
                authTitle.textContent = 'Créer un compte';
                authSubmit.innerHTML = '<i class="fas fa-user-plus"></i> S\'inscrire';
                authNameGroup.style.display = 'block';
                authToggleText.textContent = 'Déjà un compte ?';
                authToggle.textContent = 'Se connecter';
            } else {
                authTitle.textContent = 'Connexion';
                authSubmit.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
                authNameGroup.style.display = 'none';
                authToggleText.textContent = 'Pas encore de compte ?';
                authToggle.textContent = 'Créer un compte';
            }
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            const feedback = document.getElementById('auth-feedback');
            if (!email || !password) {
                feedback.textContent = 'Veuillez remplir tous les champs.';
                return;
            }
            try {
                if (authMode === 'register') {
                    const res = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'inscription.');
                    feedback.style.color = '#10b981';
                    feedback.textContent = 'Compte créé ! Connexion en cours...';
                    const loginRes = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const loginData = await loginRes.json();
                    if (!loginRes.ok) throw new Error(loginData.error || 'Erreur de connexion.');
                    localStorage.setItem('jwt_token', loginData.token);
                    feedback.style.color = '#10b981';
                    feedback.textContent = 'Connecté !';
                    hideAuthScreen();
                    initApp();
                } else {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Identifiants invalides.');
                    localStorage.setItem('jwt_token', data.token);
                    feedback.style.color = '#10b981';
                    feedback.textContent = 'Connecté !';
                    hideAuthScreen();
                    initApp();
                }
            } catch (err) {
                feedback.style.color = '#fca5a5';
                feedback.textContent = err.message;
            }
        });
    }
}

function initApp() {
    initSSE();
    loadJobs().catch(err => console.error('loadJobs error:', err.message));
    loadSystemStatus().catch(err => console.error('loadSystemStatus error:', err.message));
    startDashboardAutoRefresh();
}

// SSE gives immediate updates; this low-frequency fallback also refreshes a
// dashboard left open in the background when an SSE connection is interrupted.
let dashboardRefreshTimer;
function startDashboardAutoRefresh() {
    if (dashboardRefreshTimer) clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = setInterval(() => {
        if (document.hidden || !localStorage.getItem('jwt_token')) return;
        loadJobs().catch(() => {});
    }, 30_000);
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function initSSE() {
    if (!window.EventSource) return;
    const token = localStorage.getItem('jwt_token');
    const sseUrl = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events';
    const evtSource = new EventSource(sseUrl);
    const statusEl = document.getElementById('system-status');

    evtSource.addEventListener('connected', () => {
        if (statusEl) {
            statusEl.innerHTML = `<span class="pulse-dot"></span> En direct`;
            statusEl.style.color = '#10b981';
        }
    });

    evtSource.addEventListener('search_run_updated', (e) => {
        try {
            const data = JSON.parse(e.data || '{}');
            if (typeof loadSearchRuns === 'function') loadSearchRuns();
            if (typeof loadSystemStatus === 'function') loadSystemStatus();
            if (typeof loadJobs === 'function') loadJobs().catch(() => {});
            if (data.status === 'completed') {
                showToast('Recherche multi-providers terminée !', 'success');
                if (typeof loadJobs === 'function') loadJobs().catch(() => {});
            } else if (data.status === 'failed') {
                showToast('Erreur dans un workflow de recherche.', 'error');
            } else if (data.status === 'queued') {
                showToast(`Recherche lancée: ${data.title || ''}`, 'info');
            }
        } catch {
            // Error parsing event
        }
    });

    evtSource.addEventListener('job_updated', () => {
        if (typeof loadJobs === 'function') loadJobs().catch(() => {});
    });

    evtSource.addEventListener('job_deleted', () => {
        if (typeof loadJobs === 'function') loadJobs().catch(() => {});
    });

    evtSource.addEventListener('jobs_refreshed', () => {
        if (typeof loadJobs === 'function') loadJobs().catch(() => {});
    });

    evtSource.onerror = () => {
        if (statusEl) {
            statusEl.innerHTML = `<i class="fas fa-plug" style="font-size: 0.8rem;"></i> Reconnexion...`;
            statusEl.style.color = '#f59e0b';
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

// Tab Management
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        
        if (btn.dataset.tab === 'dashboard') loadJobs().catch(err => console.error('loadJobs error:', err.message));
        if (btn.dataset.tab === 'search') loadSearchRuns();
        if (btn.dataset.tab === 'configs') loadConfigs();
        if (btn.dataset.tab === 'providers') loadProviders();
        if (btn.dataset.tab === 'scheduler') loadSchedules();
        if (btn.dataset.tab === 'notifications') loadWebhooks();
        if (btn.dataset.tab === 'cvs') loadCvs();
        if (btn.dataset.tab === 'settings') loadProfile();
    });
});

function getStatusClass(status) {
    if (status === 'Soumis') return 'submitted';
    if (status === 'En attente de confirmation') return 'pending';
    if (status === 'Échec') return 'failed';
    return 'registered';
}

// Dashboard: Load Jobs
async function loadJobs() {
    let jobs;
    try {
        jobs = await api('/jobs');
    } catch (error) {
        const message = `<p class="empty-state">${escapeHtml(error.message || 'Impossible de charger les offres.')}</p>`;
        document.getElementById('jobs-list-to-process')?.replaceChildren();
        document.getElementById('jobs-list-submitted')?.replaceChildren();
        document.getElementById('jobs-list-to-process')?.insertAdjacentHTML('beforeend', message);
        return;
    }
    const toProcessList = document.getElementById('jobs-list-to-process');
    const submittedList = document.getElementById('jobs-list-submitted');
    const totalEl = document.getElementById('total-jobs');
    const avgEl = document.getElementById('avg-score');
    
    // Statistiques : seulement pour les offres non soumises
    const toProcess = jobs.filter(j => j.status !== 'Soumis');
    const submitted = jobs.filter(j => j.status === 'Soumis');

    totalEl.textContent = toProcess.length;
    const avg = toProcess.length ? Math.round(toProcess.reduce((a, b) => a + (b.score || 0), 0) / toProcess.length) : 0;
    avgEl.textContent = `${avg}%`;
    await loadSystemStatus();
    
    const renderJob = (job) => {
        const badgeClass = getStatusClass(job.status);
        let actionBtn = '';
        if (job.status === 'En attente de confirmation') {
            actionBtn = `
                <button type="button" onclick="confirmJob(${job.id})" class="btn-confirm" title="Confirmer en 1-clic l'envoi">
                    <i class="fas fa-check-circle"></i> Valider & Envoyer
                </button>
                <button type="button" onclick="viewPack(${job.id})" class="btn-outline" title="Voir le pack prêt">
                    <i class="fas fa-box-open"></i> Dossier Prêt
                </button>
            `;
        } else if (job.status === 'Enregistré' || job.status === 'Échec') {
            actionBtn = `
                <button type="button" onclick="applyJob(${job.id}, this)" class="btn-apply" title="Lancer le cycle de candidature">
                    <i class="fas fa-paper-plane"></i> Postuler
                </button>
            `;
        }
        
        return `
            <div class="job-card" style="border-left: 4px solid ${badgeClass === 'submitted' ? '#10b981' : badgeClass === 'pending' ? '#f59e0b' : '#6366f1'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div>
                        <span class="score-badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-weight: 700; padding: 4px 8px; border-radius: 6px;">Match IA: ${job.score}%</span>
                        <span class="provider-badge" style="font-size: 0.75rem; background: rgba(255,255,255,0.08); padding: 3px 6px; border-radius: 4px; margin-left: 5px;"><i class="fas fa-layer-group"></i> ${escapeHtml(job.provider || 'generic')}</span>
                    </div>
                    <span class="status-badge status-${badgeClass}" style="padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">${escapeHtml(job.status)}</span>
                </div>
                
                <h3 style="margin-top: 10px; font-size: 1.1rem;">${escapeHtml(job.title)}</h3>
                <span class="company" style="color: #60a5fa; font-weight: 500;">${escapeHtml(job.company)}</span>
                
                <div class="job-details" style="font-size: 0.85rem; color: #9ca3af; margin: 8px 0; display: flex; gap: 15px; flex-wrap: wrap;">
                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(job.country || 'N/A')}</span>
                    ${job.contract_type ? `<span><i class="fas fa-file-contract"></i> ${escapeHtml(job.contract_type)}</span>` : ''}
                    ${job.salary && job.salary !== 'N/A' ? `<span><i class="fas fa-coins"></i> ${escapeHtml(job.salary)}</span>` : ''}
                    ${job.submitted_at ? `<span><i class="fas fa-calendar-check"></i> ${new Date(job.submitted_at).toLocaleDateString()}</span>` : ''}
                </div>
                
                <div class="analysis" style="font-size: 0.85rem; color: #d1d5db; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; margin-bottom: 12px;">
                    ${escapeHtml((job.analysis || 'Analyse IA indisponible.').substring(0, 160))}...
                </div>
                
                ${job.error ? `<div class="job-error-msg" style="color: #fca5a5; font-size: 0.8rem; margin: 0.5rem 0; padding: 6px; background: rgba(239, 68, 68, 0.15); border-radius: 4px;"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(job.error)}</div>` : ''}
                
                <div class="actions" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: auto;">
                    <button type="button" onclick="downloadPdf(${job.id})" class="btn-outline" title="Télécharger la lettre PDF">
                        <i class="fas fa-file-pdf"></i> Lettre PDF
                    </button>
                    <a href="${escapeHtml(job.link)}" target="_blank" class="btn-outline" title="Ouvrir le lien de l'offre">
                        <i class="fas fa-external-link-alt"></i> Offre
                    </a>
                    ${actionBtn}
                    <button type="button" onclick="deleteJob(${job.id})" class="btn-danger" title="Supprimer" style="margin-left: auto;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    };

    toProcessList.innerHTML = toProcess.length ? toProcess.map(renderJob).join('') : '<p class="empty-state">Aucune offre à traiter pour le moment.</p>';
    submittedList.innerHTML = submitted.length ? submitted.map(renderJob).join('') : '<p class="empty-state">Aucune candidature envoyée.</p>';
}

async function loadSystemStatus() {
    try {
        const status = await api('/system/status');
        const analyzedEl = document.getElementById('last-search-analyzed');
        const newJobsEl = document.getElementById('last-search-new');
        const lastSearchEl = document.getElementById('last-search-time');
        const systemStatusEl = document.getElementById('system-status');

        if (analyzedEl) analyzedEl.textContent = String(status.lastAnalyzedJobs || 0);
        if (newJobsEl) newJobsEl.textContent = String(status.lastNewJobs || 0);
        if (lastSearchEl) {
            lastSearchEl.textContent = status.lastSearchAt ? new Date(status.lastSearchAt).toLocaleString('fr-FR') : 'Jamais';
        }
        if (systemStatusEl && status.lastSearchStatus) {
            const isHealthy = status.lastSearchStatus !== 'failed';
            const label = status.lastSearchStatus === 'completed'
                ? 'OK'
                : status.lastSearchStatus === 'running'
                    ? 'En cours'
                    : status.lastSearchStatus === 'queued'
                        ? 'En attente'
                        : 'Erreur';
            systemStatusEl.innerHTML = `${isHealthy ? '<span class="pulse-dot"></span>' : '<i class="fas fa-exclamation-triangle"></i>'} ${escapeHtml(label)}`;
            systemStatusEl.style.color = isHealthy ? '#10b981' : '#f59e0b';
        }
    } catch (error) {
        console.error('Erreur chargement statut système:', error);
    }
}

async function deleteJob(id) {
    if (confirm('Supprimer cette offre de la liste ?')) {
        try {
            await api(`/jobs/${id}`, 'DELETE');
            await loadJobs();
        } catch (error) {
            console.error(`Erreur suppression offre ${id}:`, error);
            alert(error.message || 'Impossible de supprimer cette offre.');
        }
    }
}

async function confirmJob(id) {
    try {
        const res = await api(`/jobs/${id}/confirm`, 'POST');
        alert(res.message || "Candidature marquée comme soumise !");
        loadJobs();
    } catch (e) {
        alert(e.message);
    }
}

async function viewPack(id) {
    try {
        const data = await api(`/jobs/${id}/pack`);
        const packStr = JSON.stringify(data.pack || {}, null, 2);
        alert(`Dossier préparé pour ${data.company} (${data.title}) :\n\nLien direct: ${data.link}\n\nDonnées pré-remplies:\n${packStr}`);
    } catch (e) {
        alert(e.message);
    }
}

async function applyJob(id, btn) {
    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';
    try {
        const res = await api(`/jobs/${id}/apply`, 'POST');
        if (res.status === 'Soumis') {
            alert("Candidature soumise automatiquement avec succès !");
        } else if (res.status === 'En attente de confirmation') {
            alert("Le dossier de candidature est entièrement préparé (Lettre PDF, CV ciblé & champs prêts). Cliquez sur 'Valider & Envoyer' après vérification.");
        } else {
            alert(`Résultat : ${res.status}`);
        }
        loadJobs();
    } catch (e) {
        alert(e.message);
        loadJobs();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }
}

async function downloadPdf(jobId) {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
        showAuthScreen();
        return;
    }
    try {
        const response = await fetch(`/api/jobs/${jobId}/pdf`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('jwt_token');
            showAuthScreen();
            return;
        }
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'PDF introuvable.');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lettre-${jobId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert(e.message || 'Impossible de télécharger le PDF.');
    }
}

async function logout() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        try {
            await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        } catch {
            // Clear the local session even if the network is unavailable.
        }
    }
    localStorage.removeItem('jwt_token');
    showAuthScreen();
}

// Providers Management
async function loadProviders() {
    try {
        const providers = await api('/providers');
        const grid = document.getElementById('providers-list-grid');

        // Check if user is SUPER_ADMIN
        const token = localStorage.getItem('jwt_token');
        let isAdmin = false;
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                isAdmin = payload.role === 'SUPER_ADMIN';
            } catch {}
        }

        grid.innerHTML = providers.map(p => `
            <div class="provider-card" style="background: var(--bg-card, #1e293b); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 1rem; color: #f8fafc;">${escapeHtml(p.name)}</strong>
                    <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; background: rgba(99,102,241,0.2); color: #a5b4fc;">${escapeHtml(p.type)}</span>
                </div>
                <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 12px;">
                    ID: <code>${escapeHtml(p.id)}</code> | Pays: ${escapeHtml((p.countries || []).join(', '))}
                </div>
                <div style="font-size: 0.8rem; color: ${p.enabled ? '#10b981' : '#94a3b8'}; font-weight: 600;">
                    ${p.enabled ? '<i class="fas fa-check-circle"></i> Actif' : '<i class="fas fa-power-off"></i> Inactif'}
                </div>
                ${isAdmin ? `<button onclick="toggleProvider('${p.id}', ${!p.enabled})" style="width: 100%; margin-top: 8px; padding: 8px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; background: ${p.enabled ? '#475569' : '#10b981'}; color: white;">
                    ${p.enabled ? '<i class="fas fa-toggle-off"></i> Désactiver' : '<i class="fas fa-toggle-on"></i> Activer'}
                </button>` : ''}
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('providers-list-grid').innerHTML = `<p class="empty-state">${escapeHtml(e.message)}</p>`;
    }
}

async function toggleProvider(id, enabled) {
    try {
        // Check if user is SUPER_ADMIN
        const token = localStorage.getItem('jwt_token');
        let isAdmin = false;
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                isAdmin = payload.role === 'SUPER_ADMIN';
            } catch {}
        }

        const endpoint = isAdmin ? `/admin/providers/${id}/toggle` : `/providers/${id}/toggle`;
        await api(endpoint, 'POST', { enabled });
        loadProviders();
    } catch (e) {
        alert(e.message);
    }
}

// Search: Launch Automation
document.getElementById('btn-launch-search').addEventListener('click', async () => {
    const btn = document.getElementById('btn-launch-search');
    const data = {
        country: document.getElementById('search-country').value,
        title: document.getElementById('search-title').value,
        keywords: document.getElementById('search-keywords').value,
        city: document.getElementById('search-city').value,
        experienceLevel: document.getElementById('search-experience').value,
        contractType: document.getElementById('search-contract').value,
        remote: document.getElementById('search-remote').value,
        jobType: document.getElementById('search-jobtype').value,
        lang: document.getElementById('search-lang').value,
        minSalary: document.getElementById('search-min-salary')?.value || '',
        maxSalary: document.getElementById('search-max-salary')?.value || ''
    };

    if (!data.title) return alert('Veuillez saisir un titre de métier.');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recherche & IA en cours...';
    
    try {
        const result = await api('/search', 'POST', data);
        alert("Recherche multi-providers lancée en arrière-plan (24/7). Les résultats apparaîtront dans le tableau de bord !");
        loadSearchRuns();
        if (result.runId) waitForSearchCompletion(result.runId);
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Lancer la recherche multi-providers';
    }
});

async function waitForSearchCompletion(runId) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        try {
            const runs = await api('/search-runs');
            const run = runs.find(item => Number(item.id) === Number(runId));
            if (!run || !['completed', 'failed'].includes(run.status)) continue;
            await loadJobs();
            await loadSystemStatus();
            await loadSearchRuns();
            return;
        } catch {
            // SSE/refresh will retry while the search is running.
        }
    }
}

// CVS: Load List
async function loadCvs() {
    try {
        const cvs = await api('/cvs');
        const list = document.getElementById('cv-list');
        const uploadSection = document.getElementById('cv-upload-section');
        const primaryNotice = document.getElementById('cv-primary-notice');

        const hasPrimary = cvs.some(cv => cv.is_primary);

        // Show/hide upload section based on primary CV
        if (uploadSection) {
            uploadSection.style.display = hasPrimary ? 'none' : 'flex';
        }
        if (primaryNotice) {
            primaryNotice.style.display = hasPrimary ? 'block' : 'none';
        }

        list.innerHTML = cvs.length ? cvs.map(cv => `
            <div class="cv-card" style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 10px; ${cv.is_primary ? 'border: 2px solid #f59e0b;' : ''}">
                <div>
                    <h3 style="margin: 0; font-size: 1rem;">
                        ${cv.is_primary ? '<span style="color: #f59e0b; margin-right: 6px;" title="CV Principal (source de vérité)">👑</span>' : ''}
                        ${escapeHtml(cv.name)}
                    </h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #94a3b8;">
                        ${cv.is_primary ? '🔒 CV Principal — Non supprimable' : (cv.is_active ? '✅ CV Actif par défaut' : 'CV disponible')}
                        ${cv.lang ? ' · Langue: ' + escapeHtml(cv.lang).toUpperCase() : ''}
                    </p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    ${!cv.is_primary ? `<button onclick="activateCv(${cv.id})" class="btn-active" ${cv.is_active ? 'disabled' : ''} style="padding: 6px 14px; border-radius: 6px;">${cv.is_active ? 'Actif' : 'Activer'}</button>` : ''}
                    ${!cv.is_primary ? `<button onclick="deleteCv(${cv.id}, '${escapeHtml(cv.name).replace(/'/g, "\\'")}')" class="btn-delete" style="padding: 6px 14px; border-radius: 6px; background: #dc2626; color: white; border: none; cursor: pointer;">Supprimer</button>` : ''}
                </div>
            </div>
        `).join('') : '<p class="empty-state">Aucun CV enregistré. Importez votre CV ci-dessus pour commencer à postuler.</p>';
    } catch (error) {
        alert(error.message);
    }
}

// CVS: Upload
async function uploadCv() {
    const nameInput = document.getElementById('cv-name');
    const fileInput = document.getElementById('cv-file');
    const name = nameInput?.value?.trim();
    const file = fileInput?.files?.[0];

    if (!name) return alert('Veuillez donner un nom au CV.');
    if (!file) return alert('Veuillez sélectionner un fichier.');

    const btn = document.getElementById('btn-upload-cv');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importation...';

    try {
        let content = '';
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            const reader = new FileReader();
            content = await new Promise((resolve, reject) => {
                reader.onload = () => {
                    const bytes = new Uint8Array(reader.result);
                    let binary = '';
                    const chunkSize = 8192;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
                    }
                    resolve(`[PDF:${file.name}]\n` + btoa(binary));
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        } else {
            content = await file.text();
        }

        await api('/cvs', 'POST', { name, content });
        nameInput.value = '';
        fileInput.value = '';
        await loadCvs();
    } catch (error) {
        alert(error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-upload"></i> Importer';
    }
}

async function useCvTemplate() {
    const name = window.prompt('Nom de votre copie du modèle :', 'Mon CV basé sur le modèle');
    if (name === null) return;
    try {
        await api('/cvs/from-template', 'POST', { name: name.trim() || 'Mon CV basé sur le modèle' });
        await loadCvs();
        showToast('Le modèle a été copié dans votre espace privé.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// CVS: Delete
async function deleteCv(id, name) {
    if (!confirm(`Supprimer le CV "${name}" ?`)) return;
    try {
        await api(`/cvs/${id}`, 'DELETE');
        await loadCvs();
    } catch (error) {
        alert(error.message);
    }
}

// CVS: Upload button click
document.getElementById('btn-upload-cv')?.addEventListener('click', uploadCv);

const runStatusLabels = {
    queued: 'En attente',
    running: 'En cours',
    completed: 'Terminée',
    failed: 'Échouée'
};

async function loadSearchRuns() {
    try {
        const runs = await api('/search-runs');
        const list = document.getElementById('search-runs-list');
        list.innerHTML = runs.length ? runs.map((run) => `
            <article class="run-card" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #1e293b; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
                <div>
                    <strong style="color: #f8fafc;">${escapeHtml(run.title)}</strong>
                    <span style="color: #94a3b8; font-size: 0.85rem; margin-left: 10px;">${escapeHtml(run.country)}${run.keywords ? ` · ${escapeHtml(run.keywords)}` : ''}</span>
                    <div style="color: #cbd5e1; font-size: 0.8rem; margin-top: 4px;">
                        <i class="fas fa-search"></i> Analysées: ${Number(run.analyzed_jobs_count || 0)}
                        <span style="margin: 0 6px;">|</span>
                        <i class="fas fa-plus-circle"></i> Nouvelles: ${Number(run.saved_jobs_count || 0)}
                        <span style="margin: 0 6px;">|</span>
                        <i class="fas fa-layer-group"></i> Doublons: ${Number(run.duplicate_jobs_count || 0)}
                    </div>
                </div>
                <span class="run-status status-${escapeHtml(run.status)}" style="font-size: 0.8rem; font-weight: 600;">${runStatusLabels[run.status] || 'Inconnue'}</span>
            </article>
        `).join('') : '<p class="empty-state">Aucune recherche lancée.</p>';
    } catch (error) {
        document.getElementById('search-runs-list').innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    }
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
    const el = document.getElementById(id);
    if (el) el.value = value || '';
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
        feedback.textContent = 'Profil enregistré avec succès.';
    } catch (error) {
        feedback.textContent = error.message;
    }
});

document.getElementById('btn-use-cv-template')?.addEventListener('click', useCvTemplate);

// === SEARCH CONFIGS ===

async function loadConfigs() {
    try {
        const configs = await api('/search-configs');
        const list = document.getElementById('configs-list');
        if (!list) return;

        list.innerHTML = configs.length ? configs.map(c => {
            const filters = [
                c.city ? `<i class="fas fa-map-marker-alt"></i> ${escapeHtml(c.city)}` : '',
                c.experience_level ? `<i class="fas fa-chart-bar"></i> ${escapeHtml(c.experience_level)}` : '',
                c.contract_type ? `<i class="fas fa-file-contract"></i> ${escapeHtml(c.contract_type)}` : '',
                c.remote ? `<i class="fas fa-wifi"></i> ${escapeHtml(c.remote)}` : '',
                c.job_type ? `<i class="fas fa-briefcase"></i> ${escapeHtml(c.job_type)}` : '',
                c.salary ? `<i class="fas fa-coins"></i> ${escapeHtml(c.salary)}` : '',
                c.min_salary ? `<i class="fas fa-coins"></i> Min ${escapeHtml(c.min_salary)}` : '',
                c.max_salary ? `<i class="fas fa-coins"></i> Max ${escapeHtml(c.max_salary)}` : ''
            ].filter(Boolean).join(' | ');

            return `
                <div class="run-item" style="display:flex; justify-content:space-between; align-items:center; padding:14px; background: var(--bg-card); border-radius:10px; border-left: 4px solid #6366f1; margin-bottom: 10px;">
                    <div>
                        <strong style="font-size: 1.05rem;">${escapeHtml(c.name)}</strong>
                        <div style="color: #9ca3af; font-size: 0.85rem; margin-top: 4px;">
                            <i class="fas fa-briefcase"></i> ${escapeHtml(c.title)} | <i class="fas fa-globe"></i> ${escapeHtml(c.country)}
                            ${c.keywords ? ` | <i class="fas fa-tags"></i> ${escapeHtml(c.keywords)}` : ''}
                        </div>
                        ${filters ? `<div style="color: #a5b4fc; font-size: 0.8rem; margin-top: 4px;">${filters}</div>` : ''}
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button onclick="runConfig(${c.id})" class="btn-confirm" title="Lancer cette recherche">
                            <i class="fas fa-play"></i> Lancer
                        </button>
                        <button onclick="deleteConfig(${c.id})" class="btn-danger" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('') : '<p class="empty-state">Aucune configuration sauvegardée.</p>';
    } catch (e) {
        console.error('Erreur chargement configs:', e);
    }
}

async function runConfig(id) {
    try {
        const res = await api(`/search-configs/${id}/run`, 'POST');
        showToast(res.message || 'Recherche lancée !', 'success');
        loadSearchRuns();
    } catch (e) {
        alert(e.message);
    }
}

async function deleteConfig(id) {
    if (!confirm('Supprimer cette configuration ?')) return;
    try {
        await api(`/search-configs/${id}`, 'DELETE');
        showToast('Configuration supprimée.', 'info');
        loadConfigs();
    } catch (e) {
        alert(e.message);
    }
}

document.getElementById('btn-save-config')?.addEventListener('click', async () => {
    const name = document.getElementById('cfg-name')?.value?.trim();
    const country = document.getElementById('cfg-country')?.value?.trim();
    const title = document.getElementById('cfg-title')?.value?.trim();

    if (!name || !country || !title) {
        alert('Veuillez remplir le nom, le pays et le métier.');
        return;
    }

    const config = {
        name,
        country,
        city: document.getElementById('cfg-city')?.value?.trim() || '',
        title,
        keywords: document.getElementById('cfg-keywords')?.value?.trim() || '',
        experience_level: document.getElementById('cfg-experience')?.value || '',
        contract_type: document.getElementById('cfg-contract')?.value || '',
        remote: document.getElementById('cfg-remote')?.value || '',
        min_salary: document.getElementById('cfg-min-salary')?.value || '',
        max_salary: document.getElementById('cfg-max-salary')?.value || ''
    };

    try {
        await api('/search-configs', 'POST', config);
        showToast(`Configuration "${name}" sauvegardée !`, 'success');
        document.getElementById('cfg-name').value = '';
        document.getElementById('cfg-title').value = '';
        document.getElementById('cfg-keywords').value = '';
        loadConfigs();
    } catch (e) {
        alert(e.message);
    }
});

// === SCHEDULER (Recherches planifiées) ===

const CRON_LABELS = {
    '0 * * * *': 'Toutes les heures',
    '0 0 * * *': 'Chaque jour à minuit',
    '0 8 * * 1-5': 'Lundi–Vendredi à 8h'
};

async function loadSchedules() {
    try {
        const schedules = await api('/schedules');
        const list = document.getElementById('schedules-list');
        if (!list) return;

        list.innerHTML = schedules.length ? schedules.map(s => {
                const cronLabel = CRON_LABELS[s.cron_expression] || s.cron_expression;
                const statusColor = s.enabled ? '#10b981' : '#6b7280';
                const statusLabel = s.enabled ? 'Actif' : 'Suspendu';
                const lastRun = s.last_run_at ? new Date(s.last_run_at).toLocaleString('fr-FR') : 'Jamais';
                const salaryLabel = [s.salary ? `Salaire ${s.salary}` : '', s.min_salary ? `Min ${s.min_salary}` : '', s.max_salary ? `Max ${s.max_salary}` : ''].filter(Boolean).join(' | ');
                const lastStatus = s.last_status === 'success' ? 'Succès' : s.last_status === 'error' ? 'Erreur' : (s.last_status || '—');

            return `
                <div class="run-item" style="display:flex; justify-content:space-between; align-items:center; padding:14px; background: var(--bg-card); border-radius:10px; border-left: 4px solid ${statusColor}; margin-bottom: 10px;">
                    <div>
                        <strong style="font-size: 1.05rem;">${escapeHtml(s.name)}</strong>
                        <div style="color: #9ca3af; font-size: 0.85rem; margin-top: 4px;">
                            <i class="fas fa-briefcase"></i> ${escapeHtml(s.title)} | <i class="fas fa-map-marker-alt"></i> ${escapeHtml(s.country)}
                            ${s.keywords ? `| <i class="fas fa-tags"></i> ${escapeHtml(s.keywords)}` : ''}
                        </div>
                        ${salaryLabel ? `<div style="color: #fbbf24; font-size: 0.8rem; margin-top: 4px;"><i class="fas fa-coins"></i> ${escapeHtml(salaryLabel)}</div>` : ''}
                        <div style="color: #9ca3af; font-size: 0.8rem; margin-top: 4px;">
                            <i class="fas fa-clock"></i> ${escapeHtml(cronLabel)} | <i class="fas fa-history"></i> ${s.total_runs} ex\u00e9cution(s) | Derni\u00e8re : ${lastRun}
                        </div>
                        <div style="color: #cbd5e1; font-size: 0.8rem; margin-top: 4px;">
                            <i class="fas fa-chart-line"></i> Analysées: ${Number(s.last_analyzed_jobs_count || 0)} | <i class="fas fa-plus-circle"></i> Nouvelles: ${Number(s.last_new_jobs_count || 0)} | <i class="fas fa-circle-info"></i> Statut: ${escapeHtml(lastStatus)}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span style="color:${statusColor}; font-weight:600; font-size: 0.85rem;"><span class="${s.enabled ? 'pulse-dot' : ''}" style="margin-right:5px;"></span>${statusLabel}</span>
                        <button onclick="toggleSchedule(${s.id}, ${s.enabled ? 'false' : 'true'})" class="btn-outline" title="${s.enabled ? 'Suspendre' : 'Activer'}">
                            <i class="fas fa-${s.enabled ? 'pause' : 'play'}"></i>
                        </button>
                        <button onclick="deleteSchedule(${s.id})" class="btn-danger" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('') : '<p class="empty-state">Aucune recherche planifi\u00e9e. Cr\u00e9ez-en une ci-dessus.</p>';
    } catch (e) {
        console.error('Erreur chargement schedules:', e);
    }
}

async function toggleSchedule(id, enabled) {
    try {
        await api(`/schedules/${id}/toggle`, 'PUT', { enabled });
        showToast(enabled ? 'Recherche planifi\u00e9e activ\u00e9e.' : 'Recherche planifi\u00e9e suspendue.', enabled ? 'success' : 'warning');
        loadSchedules();
    } catch (e) {
        alert(e.message);
    }
}

async function deleteSchedule(id) {
    if (!confirm('Supprimer cette recherche planifi\u00e9e ?')) return;
    try {
        await api(`/schedules/${id}`, 'DELETE');
        showToast('Recherche planifi\u00e9e supprim\u00e9e.', 'info');
        loadSchedules();
    } catch (e) {
        alert(e.message);
    }
}

document.getElementById('btn-create-schedule')?.addEventListener('click', async () => {
    const name = document.getElementById('sched-name')?.value?.trim();
    const country = document.getElementById('sched-country')?.value?.trim();
    const title = document.getElementById('sched-title')?.value?.trim();
    const keywords = document.getElementById('sched-keywords')?.value?.trim() || '';
    const city = document.getElementById('sched-city')?.value?.trim() || '';
    const experience_level = document.getElementById('sched-experience')?.value || '';
    const contract_type = document.getElementById('sched-contract')?.value || '';
    const remote = document.getElementById('sched-remote')?.value || '';
    const min_salary = document.getElementById('sched-min-salary')?.value || '';
    const max_salary = document.getElementById('sched-max-salary')?.value || '';
    const frequency = document.getElementById('sched-frequency')?.value || 'hourly';
    const customCron = document.getElementById('sched-cron-expression')?.value?.trim() || '';
    const cron_expression = frequency === 'cron'
        ? customCron
        : frequency === 'daily'
            ? '0 0 * * *'
            : '0 * * * *';

    if (!name || !country || !title) {
        alert('Veuillez remplir le nom, le pays et le m\u00e9tier.');
        return;
    }
    try {
        await api('/schedules', 'POST', { name, country, title, keywords, city, experience_level, contract_type, remote, min_salary, max_salary, cron_expression });
        showToast(`Recherche planifi\u00e9e "${name}" cr\u00e9\u00e9e !`, 'success');
        document.getElementById('sched-name').value = '';
        document.getElementById('sched-title').value = '';
        document.getElementById('sched-keywords').value = '';
        document.getElementById('sched-city').value = '';
        loadSchedules();
    } catch (e) {
        alert(e.message);
    }
});

document.getElementById('sched-frequency')?.addEventListener('change', () => {
    const customInput = document.getElementById('sched-cron-expression');
    if (!customInput) return;
    const isCustom = document.getElementById('sched-frequency')?.value === 'cron';
    customInput.disabled = !isCustom;
});

document.getElementById('sched-cron-presets')?.addEventListener('change', () => {
    const preset = document.getElementById('sched-cron-presets')?.value;
    const customInput = document.getElementById('sched-cron-expression');
    const frequencyInput = document.getElementById('sched-frequency');
    if (!preset || !customInput) return;
    customInput.value = preset;
    customInput.disabled = false;
    if (frequencyInput) frequencyInput.value = 'cron';
});

document.getElementById('sched-frequency')?.dispatchEvent(new Event('change'));

// ADMIN DASHBOARD LOGIC
function getJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch(e) {
        return null;
    }
}

function checkAdminRole() {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;
    const payload = getJwtPayload(token);
    if (payload && payload.role === 'SUPER_ADMIN') {
        const navAdmin = document.getElementById('nav-admin');
        if (navAdmin) navAdmin.style.display = 'block';
    }
}

async function loadAdminUsers() {
    try {
        const users = await api('/admin/users');
        const tbody = document.getElementById('admin-users-list');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #334155';
            tr.innerHTML = `
                <td style="padding: 12px;">${u.id}</td>
                <td style="padding: 12px;">${u.email}</td>
                <td style="padding: 12px;">${u.role}</td>
                <td style="padding: 12px;">${u.status}</td>
                <td style="padding: 12px;">${new Date(u.created_at).toLocaleDateString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        showToast('Erreur chargement utilisateurs (admin)', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btnBackup = document.getElementById('btn-admin-backup');
    if (btnBackup) {
        btnBackup.addEventListener('click', async () => {
            try {
                const res = await api('/admin/backup', 'POST');
                showToast(res.message || 'Sauvegarde réussie', 'success');
            } catch (e) {
                showToast('Erreur lors de la sauvegarde', 'error');
            }
        });
    }

    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) {
        navAdmin.addEventListener('click', () => {
            loadAdminUsers();
        });
    }
});

// Patch initApp to check admin role
const oldInitApp = initApp;
initApp = function() {
    oldInitApp();
    checkAdminRole();
};

// === WEBHOOKS / NOTIFICATIONS ===

async function loadWebhooks() {
    try {
        const webhooks = await api('/webhooks');
        const list = document.getElementById('webhooks-list');
        if (!list) return;

        list.innerHTML = webhooks.length ? webhooks.map(w => {
            const platformIcon = w.platform === 'telegram' ? '<i class="fab fa-telegram"></i>' : '<i class="fab fa-slack"></i>';
            const platformClass = w.platform === 'telegram' ? 'telegram' : 'slack';
            const maskedUrl = w.webhook_url.length > 50
                ? w.webhook_url.slice(0, 30) + '…' + w.webhook_url.slice(-15)
                : w.webhook_url;
            const lastSent = w.last_sent_at
                ? `<i class="fas fa-clock"></i> Dernier envoi : ${new Date(w.last_sent_at).toLocaleString('fr-FR')}`
                : '<i class="fas fa-clock"></i> Jamais envoyé';
            const errorBadge = w.last_error
                ? `<span style="color:#fca5a5;" title="${escapeHtml(w.last_error)}"><i class="fas fa-exclamation-triangle"></i> Erreur</span>`
                : '';

            return `
                <div class="webhook-card platform-${w.platform} ${w.enabled ? '' : 'disabled'}">
                    <div class="webhook-info">
                        <strong>${escapeHtml(w.label || (w.platform === 'telegram' ? 'Webhook Telegram' : 'Webhook Slack'))}</strong>
                        <span class="platform-badge ${platformClass}">${platformIcon} ${w.platform}</span>
                        <span class="webhook-url" title="${escapeHtml(w.webhook_url)}">${escapeHtml(maskedUrl)}</span>
                        <div class="webhook-meta">
                            <span><i class="fas fa-star"></i> Score ≥ ${w.score_threshold}</span>
                            <span><i class="fas fa-paper-plane"></i> ${w.total_sent} envoyé(s)</span>
                            <span>${lastSent}</span>
                            ${errorBadge}
                        </div>
                    </div>
                    <div class="webhook-actions">
                        <button class="webhook-toggle ${w.enabled ? 'active' : ''}" onclick="toggleWebhook(${w.id}, ${w.enabled ? 0 : 1})" title="${w.enabled ? 'Désactiver' : 'Activer'}"></button>
                        <button onclick="testSingleWebhook(${w.id})" class="btn-confirm" style="background:#0ea5e9;padding:6px 10px;font-size:0.8rem;" title="Tester">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                        <button onclick="deleteWebhook(${w.id})" class="btn-danger" style="padding:6px 10px;font-size:0.8rem;" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('') : '<p class="empty-state"><i class="fas fa-bell-slash"></i> Aucun webhook configuré. Ajoutez une URL Telegram ou Slack ci-dessus.</p>';
    } catch (e) {
        console.error('Erreur chargement webhooks:', e);
    }
}

document.getElementById('btn-add-webhook')?.addEventListener('click', async () => {
    const url = document.getElementById('wh-url')?.value?.trim();
    const label = document.getElementById('wh-label')?.value?.trim() || '';
    const threshold = Number(document.getElementById('wh-threshold')?.value || 70);
    const feedback = document.getElementById('wh-feedback');

    if (!url) {
        if (feedback) { feedback.textContent = '⚠️ URL du webhook requise.'; feedback.style.color = '#fca5a5'; }
        return;
    }

    try {
        await api('/webhooks', 'POST', { webhook_url: url, label, score_threshold: threshold });
        showToast('Webhook ajouté avec succès !', 'success');
        if (feedback) feedback.textContent = '';
        document.getElementById('wh-url').value = '';
        document.getElementById('wh-label').value = '';
        document.getElementById('wh-threshold').value = '70';
        loadWebhooks();
    } catch (e) {
        if (feedback) { feedback.textContent = '❌ ' + e.message; feedback.style.color = '#fca5a5'; }
    }
});

document.getElementById('btn-test-webhook')?.addEventListener('click', async () => {
    const url = document.getElementById('wh-url')?.value?.trim();
    const feedback = document.getElementById('wh-feedback');

    if (!url) {
        if (feedback) { feedback.textContent = '⚠️ Entrez une URL puis cliquez sur Tester.'; feedback.style.color = '#fca5a5'; }
        return;
    }

    try {
        if (feedback) { feedback.textContent = '⏳ Envoi du message de test...'; feedback.style.color = '#94a3b8'; }
        const result = await api('/webhooks/test', 'POST', { webhook_url: url });
        if (result.success) {
            if (feedback) { feedback.textContent = `✅ Message de test envoyé via ${result.platform} !`; feedback.style.color = '#86efac'; }
            showToast('Message de test envoyé !', 'success');
        } else {
            if (feedback) { feedback.textContent = '❌ ' + (result.error || 'Échec de l\'envoi.'); feedback.style.color = '#fca5a5'; }
        }
    } catch (e) {
        if (feedback) { feedback.textContent = '❌ ' + e.message; feedback.style.color = '#fca5a5'; }
    }
});

async function toggleWebhook(id, enabled) {
    try {
        await api(`/webhooks/${id}`, 'PUT', { enabled: Boolean(enabled) });
        loadWebhooks();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteWebhook(id) {
    if (!confirm('Supprimer ce webhook ?')) return;
    try {
        await api(`/webhooks/${id}`, 'DELETE');
        showToast('Webhook supprimé.', 'info');
        loadWebhooks();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function testSingleWebhook(id) {
    try {
        showToast('Envoi du message de test...', 'info');
        const webhooks = await api('/webhooks');
        const wh = webhooks.find(w => w.id === id);
        if (!wh) { showToast('Webhook introuvable.', 'error'); return; }
        const result = await api('/webhooks/test', 'POST', { webhook_url: wh.webhook_url });
        if (result.success) {
            showToast(`Test réussi via ${result.platform} !`, 'success');
        } else {
            showToast('Échec : ' + (result.error || 'Erreur inconnue'), 'error');
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}
