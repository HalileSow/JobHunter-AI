const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('site/index.html', 'utf8');

// Add nav button
const navHtml = `                <button class="nav-item" data-tab="settings"><i class="fas fa-user-cog"></i> Profil & Paramètres</button>
                <button class="nav-item" id="nav-admin" data-tab="admin" style="display:none; color: #f43f5e;"><i class="fas fa-user-shield"></i> Administration</button>`;
html = html.replace('<button class="nav-item" data-tab="settings"><i class="fas fa-user-cog"></i> Profil & Paramètres</button>', navHtml);

// Add section
const sectionHtml = `
            <!-- TAB: ADMIN -->
            <section id="admin" class="tab-content">
                <header>
                    <h1>Tableau de Bord Administrateur</h1>
                    <p>Gérez les utilisateurs et les actions globales du système.</p>
                </header>
                <div class="admin-grid" style="margin-top: 2rem;">
                    <button id="btn-admin-backup" class="btn-primary" style="margin-bottom: 2rem; background-color: #f43f5e;">
                        <i class="fas fa-database"></i> Lancer une sauvegarde (Backup)
                    </button>
                    <h2>Liste des Utilisateurs</h2>
                    <div style="overflow-x:auto;">
                        <table style="width: 100%; text-align: left; border-collapse: collapse; margin-top: 1rem;">
                            <thead>
                                <tr style="border-bottom: 1px solid #334155;">
                                    <th style="padding: 12px;">ID</th>
                                    <th style="padding: 12px;">Email</th>
                                    <th style="padding: 12px;">Rôle</th>
                                    <th style="padding: 12px;">Statut</th>
                                    <th style="padding: 12px;">Créé le</th>
                                </tr>
                            </thead>
                            <tbody id="admin-users-list">
                                <!-- Users injected here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </main>`;
html = html.replace('</main>', sectionHtml);

fs.writeFileSync('site/index.html', html);


// 2. Update app.js
let js = fs.readFileSync('site/app.js', 'utf8');

const adminJs = `
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
        const users = await apiCall('/api/admin/users');
        const tbody = document.getElementById('admin-users-list');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #334155';
            tr.innerHTML = \`
                <td style="padding: 12px;">\${u.id}</td>
                <td style="padding: 12px;">\${u.email}</td>
                <td style="padding: 12px;">\${u.role}</td>
                <td style="padding: 12px;">\${u.status}</td>
                <td style="padding: 12px;">\${new Date(u.created_at).toLocaleDateString()}</td>
            \`;
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
                const res = await apiCall('/api/admin/backup', 'POST');
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
`;

js += adminJs;

fs.writeFileSync('site/app.js', js);
