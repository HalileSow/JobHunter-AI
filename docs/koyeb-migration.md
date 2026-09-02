# Migration Render → Koyeb (Free Tier)

## Pourquoi Koyeb ?

| Critère | Render (Starter) | Koyeb (Free) |
|---|---|---|
| **RAM** | 512 MB | **1 GB** |
| **CPU** | partagé | **1 vCPU** dédié |
| **Stockage** | Éphémère | **10 GB** persistants |
| **Base de données** | PostgreSQL géré | **PostgreSQL géré** (gratuit) |
| **Carte bancaire** | Oui | **Non** ❌ |
| **Déploiement** | GitHub / Docker | **GitHub / Docker** |
| **Stabilité** | ❌ Redémarrages | ✅ Plus de RAM |
| **Coût** | 0$ (mais instable) | **0$** |

Avec 1 Go RAM au lieu de 512 Mo, l'app devrait tenir sans OOM kill. Les providers Chromium restent désactivés (comme avant), mais les providers API (Adzuna, France Travail, Remotive, etc.) tournent sans problème.

## Architecture sur Koyeb

```
┌──────────────────────────────────────────────────┐
│                    Koyeb                          │
│                                                   │
│  ┌──────────────────────┐  ┌───────────────────┐  │
│  │  App (Docker)        │  │  PostgreSQL 16    │  │
│  │  Node.js 24 · Caddy  │←→│  (géré par Koyeb) │  │
│  │  :4173               │  │  1 Go RAM         │  │
│  └──────────────────────┘  └───────────────────┘  │
│         │                                          │
│    jobhunter-ai.koyeb.app                          │
└──────────────────────────────────────────────────┘
```

## Procédure pas à pas

### Étape 1 : Pousser le code sur GitHub

Si ce n'est pas déjà fait :

```bash
# Depuis Kali Linux
cd /home/kali/JobHunter-AI

# Vérifier que tout est commité
git status

# Si nécessaire, créer un repo GitHub et pousser
git remote add origin https://github.com/<TON_USER>/jobhunter-ai.git
git add -A
git commit -m "Préparation déploiement Koyeb"
git push -u origin main
```

### Étape 2 : Créer un compte Koyeb

1. Aller sur [https://app.koyeb.com](https://app.koyeb.com)
2. **Sign up** avec GitHub (recommandé) ou email
3. ✅ **Aucune carte bancaire demandée** pour le free tier

### Étape 3 : Créer l'application

1. Dashboard → **Create App**
2. **GitHub** → sélectionner `jobhunter-ai`
3. Koyeb détecte automatiquement le `Dockerfile` et le `koyeb.yaml`
4. Vérifier que les champs sont corrects :
   - **Port** : `4173`
   - **Health check** : `/api/health`
   - **Region** : `Frankfurt (fra)` — le plus proche d'Abidjan
5. Cliquer sur **Create App**

### Étape 4 : Configurer les secrets (API Keys)

Dans le dashboard Koyeb :

1. Aller dans **Settings → Environment variables & secrets**
2. Ajouter ces **secrets** (un par un) :

| Clé | Valeur |
|---|---|
| `JWT_SECRET` | Générer : `openssl rand -hex 64` depuis Kali |
| `ADZUNA_APP_ID` | `2ac72b16` |
| `ADZUNA_APP_KEY` | `ad51a04ff91d015a77033b8a8b1b180c` |
| `FRANCE_TRAVAIL_CLIENT_ID` | `PAR_jobhunterai_c8a81aaaa0b9bbd1f8a7ebd3baf6cbf0076817d205592a2184f682de705a6ef0` |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | `53d30dc3fcbbd0d7dba39d484693785ef56536cda1f2fe6bb93dd71ce566e4e5` |
| `GEMINI_API_KEY` | *(ta clé Gemini si tu en as une)* |

> Les secrets sont masqués dans les logs, contrairement aux variables d'environnement classiques.

### Étape 5 : Lancer le déploiement

1. **Create App** → Koyeb build automatiquement le Dockerfile
2. Le build prend ~3-5 minutes
3. Les migrations PostgreSQL s'exécutent automatiquement (via `post_build` dans `koyeb.yaml`)
4. Le super-admin seed crée le compte admin automatiquement

### Étape 6 : Vérifier

```bash
# L'app est accessible à :
# https://jobhunter-ai-<nom>.koyeb.app

# Tester l'API health
curl https://jobhunter-ai-<nom>.koyeb.app/api/health

# Tester la connexion admin (via le navigateur)
# https://jobhunter-ai-<nom>.koyeb.app/login
# Email: superadmin@jobhunter.local
# Mot de passe: SuperAdmin2024!
```

### Étape 7 : (Optionnel) Nom de domaine personnalisé

Si tu veux utiliser `jobhunter-ai.duckdns.org` :

1. Dashboard Koyeb → **Domaines** → **Add domain**
2. Entrer `jobhunter-ai.duckdns.org`
3. Suivre les instructions (ajouter un enregistrement CNAME chez duckdns.org)
4. Koyeb gère automatiquement le SSL Let's Encrypt

## Variables d'environnement

Voici ce que Koyeb configure automatiquement (via `koyeb.yaml`) :

| Variable | Source | Description |
|---|---|---|
| `NODE_ENV` | fixe `production` | Mode production |
| `PORT` | fixe `4173` | Port interne |
| `JWT_SECRET` | **secret** | Signatures JWT |
| `DATABASE_URL` | auto (PostgreSQL Koyeb) | Connexion DB |
| `PG_SSL` | `true` | SSL requis |
| `NODE_OPTIONS` | `--max-old-space-size=512` | Mémoire Node.js |
| `PG_POOL_MIN/MAX` | `0` / `3` | Pool PostgreSQL |
| `ADZUNA_APP_ID` | **secret** | API Adzuna |
| `ADZUNA_APP_KEY` | **secret** | API Adzuna |
| `FRANCE_TRAVAIL_CLIENT_ID` | **secret** | API France Travail |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | **secret** | API France Travail |
| `GEMINI_API_KEY` | **secret** | API Gemini (optionnel) |
| `SUPER_ADMIN_EMAILS` | `superadmin@jobhunter.local` | Admin auto-créé |

## Commandes utiles

```bash
# Installer la CLI Koyeb (optionnel mais pratique)
curl -s https://cli.koyeb.com/install.sh | bash

# Voir les logs
koyeb service logs jobhunter-ai/app

# Redémarrer
koyeb service redeploy jobhunter-ai/app

# Lister les déploiements
koyeb deployment list jobhunter-ai/app

# Voir les infos de la base de données
koyeb database list

# Obtenir la connection string de la DB
koyeb database get jobhunter-db
```

## Désactiver Render (une fois Koyeb stable)

Quand tout fonctionne sur Koyeb :

1. **Render Dashboard** → arrêter le service web
2. **Render Dashboard** → supprimer la base de données PostgreSQL
3. C'est tout, plus rien à payer ni à gérer

## Rollback

Si Koyeb ne fonctionne pas :

1. **Render Dashboard** → redémarrer le service
2. Re-pointer duckdns.org vers Render
3. Analyser le problème sur Koyeb

## Limitations du free tier Koyeb

| Ressource | Limite | Impact |
|---|---|---|
| **RAM** | 1 GB | ✅ 2× plus que Render |
| **vCPU** | 1 | ✅ Suffisant |
| **Stockage** | 10 GB (éphémère) | ⚠️ Les uploads de CV sont perdus au redeploy |
| **Base de données** | 1 GB PostgreSQL | ✅ Large pour les offres d'emploi |
| **Builds** | 100/mois | ✅ Plus qu'assez |
| **Bandwidth** | 100 GB/mois | ✅ Large |
| **Custom domain** | 1 | ✅ Un seul suffit |
| **Région** | plusieurs | Choisir Frankfurt (fra) |

> **⚠️ Stockage éphémère** : Les CV uploadés (dossier `cover_letters/generated/`) sont perdus à chaque redéploiement. Solution : stocker les CV sur un object storage (Backblaze B2, gratuit jusqu'à 10 GB, **sans carte bancaire**) ou utiliser un volume Koyeb (payant).

## Comparaison Render vs Koyeb (pour ce projet)

| Aspect | Render | Koyeb |
|---|---|---|
| **Stabilité** | ❌ OOM kills | ✅ 1 Go RAM (suffisant si Chromium désactivé) |
| **Carte bancaire** | ❌ Requise | ✅ **Pas nécessaire** |
| **PostgreSQL** | ✅ Gratuit | ✅ Gratuit |
| **Déploiement** | ✅ GitHub | ✅ GitHub |
| **Build Docker** | ✅ | ✅ |
| **Migrations auto** | ✅ preDeployCommand | ✅ post_build |
| **SSL** | ✅ Automatique | ✅ Automatique |
| **Stockage fichiers** | ❌ Éphémère | ⚠️ Éphémère aussi |
| **Région proche Abidjan** | ❌ USA | ✅ Francfort (~80 ms) |

## Et après ?

Une fois que Koyeb fonctionne, on pourra :

1. ✅ Réactiver certains providers Chromium (peut-être 1 à la fois, vu qu'on a 1 Go)
2. 🔜 Ajouter Backblaze B2 pour le stockage des CV (gratuit, sans carte)
3. 🔜 Configurer un domaine personnalisé duckdns.org