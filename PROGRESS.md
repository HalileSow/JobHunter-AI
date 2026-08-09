# PROGRESS - JobHunter-AI

## Completed
- [x] Initial codebase analysis.
- [x] Project tracking setup.
- [x] Database migration to Knex (SQLite/PostgreSQL ready).
- [x] JWT Authentication.
- [x] Deployment infrastructure (Docker/Compose with auto-restart & healthchecks).
- [x] **Architecture Multi-Providers Générique et Extensible** (`BaseProvider` & `ProviderRegistry`).
  - [x] Provider LinkedIn (scraping public).
  - [x] Provider Indeed (multilingue / multi-pays).
  - [x] Provider Adzuna (API officielle).
  - [x] Provider France Travail (API officielle / Open Data).
  - [x] Provider Remotive (API Télétravail International).
  - [x] Provider Enterprise ATS (Greenhouse, Lever, Ashby, Workday).
  - [x] Provider Custom Career Pages (Playwright + Extraction IA).
- [x] **Moteur d'Agrégation Multi-Providers & Dédoublonnage** (`search_engine.js`).
  - [x] Exécution en parallèle via `Promise.allSettled` et protection timeout.
  - [x] Dédoublonnage intelligent SHA-256 (titre + entreprise + lieu + normalisation URL).
  - [x] Classification et Scoring de pertinence IA (0 à 100%).
- [x] **Workflow de Candidature Souple (Auto / Confirmation)** (`submission_engine.js`).
  - [x] Dépôt automatique quand techniquement possible et autorisé par la plateforme.
  - [x] Préparation à 100% (Lettre de motivation PDF, CV ciblé, Formulaire pré-rempli) et statut `En attente de confirmation`.
  - [x] Validation et envoi en 1-clic depuis le Dashboard Web.
- [x] **Architecture Cloud 24/7 & Interface Web Responsive**.
  - [x] Docker Compose `restart: unless-stopped` et healthchecks HTTP.
  - [x] Configuration PM2 `ecosystem.config.cjs` pour déploiement VPS.
  - [x] Interface Web moderne (PC & Mobile) avec gestionnaire de providers.
- [x] **Suivi en direct via Server-Sent Events (SSE)** (`/api/events`).
  - [x] Flux événementiel temps réel pour statut des recherches et offres.
  - [x] Toasts de notifications & indicateur d'état connecté dans l'interface.
- [x] **Monitoring & Sécurité Production**.
  - [x] Endpoints de contrôle de santé `/api/health` et `/api/system/status`.
  - [x] Documentation HTTPS / SSL reverse proxy (Caddy & Nginx + Certbot).

- [x] **Sauvegardes Automatiques de la Base de Données** (`backup_db.js`).
  - [x] Copie horodatée du fichier SQLite avec rétention configurable (14 max par défaut).
  - [x] Purge automatique des anciennes sauvegardes au-delà du seuil.
  - [x] Endpoint API protégé `POST /api/admin/backup` pour déclenchement manuel.
  - [x] Tests unitaires validés (rétention, copie, purge).

## In Progress
- [ ] CI/CD automatisée (GitHub Actions) pour tests et déploiements.

## Recently Completed
- [x] **Webhooks Telegram / Slack pour alertes nouvelles offres** (`notifications.js`).
  - [x] Détection automatique de la plateforme (Telegram / Slack) depuis l'URL.
  - [x] Formats de payload adaptés : Markdown Telegram, Block Kit Slack, fallback générique.
  - [x] Table `notification_webhooks` par utilisateur (seuil de score, toggle on/off).
  - [x] API CRUD `/api/webhooks` (list, create, update, delete, test).
  - [x] Intégration non-bloquante dans le scheduler et le search_run_launcher.
