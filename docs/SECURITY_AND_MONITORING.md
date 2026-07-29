# Guide de Sécurité, SSL & Monitoring - JobHunter-AI

## 1. Sécurité et HTTPS / SSL

### Options de Reverse Proxy HTTPS

#### Option A: Caddy Server (Recommandé - SSL Automatique)
Caddy gère automatiquement l'obtention et le renouvellement des certificats SSL via Let's Encrypt.

```caddyfile
# /etc/caddy/Caddyfile
jobhunter.votre-domaine.com {
    reverse_proxy localhost:4173
}
```

#### Option B: Nginx + Certbot
Pour un serveur Nginx existant :

```nginx
server {
    server_name jobhunter.votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Support Server-Sent Events (SSE)
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
    }
}
```

Générer le certificat SSL :
```bash
sudo certbot --nginx -d jobhunter.votre-domaine.com
```

---

## 2. Endpoints de Monitoring & Santé du Système

JobHunter-AI intègre deux endpoints de monitoring pour la haute disponibilité :

### Endpoint HTTP Healthcheck (`/api/health`)
- **URL** : `GET /api/health`
- **Réponse HTTP 200** :
  ```json
  { "status": "ok", "uptime": 3600.42 }
  ```
- **Réponse HTTP 503** (en cas de panne DB) :
  ```json
  { "error": "Base de données indisponible." }
  ```

### Endpoint Statut Système (`/api/system/status`)
- **URL** : `GET /api/system/status`
- **Réponse** :
  ```json
  {
    "status": "healthy",
    "uptimeSeconds": 3600,
    "activeProviders": 7,
    "totalProviders": 7,
    "totalJobs": 42,
    "totalSearchRuns": 12,
    "connectedClients": 2
  }
  ```

---

## 3. Supervision Externe (Monitoring 24/7)

Pour configurer une alerte externe en cas d'interruption de service :
- **Outils recommandés** : Uptime Kuma, Better Stack, Pingdom, Hetzner Server Monitoring.
- **Target URL** : `https://jobhunter.votre-domaine.com/api/health`
- **Intervalle** : Toutes les 60 secondes.
- **Seuil d'alerte** : Notification Telegram / Email si le serveur ne réponds pas avec `HTTP 200`.

---

## 4. Recommandations de Sécurité en Production

1. **Variables d'environnement** :
   - Modifier `JWT_SECRET` dans le fichier `.env` avec une clé aléatoire forte (`openssl rand -hex 32`).
2. **CORS & En-têtes HTTP Security** :
   - Les origines sont restreintes au domaine du dashboard.
3. **Mise à jour automatique des certificats** :
   - Certbot renouvelle automatiquement les certificats avant expiration (via timer systemd ou cron).
