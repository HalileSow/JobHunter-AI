# Guide de déploiement JobHunter-AI

## Prérequis
- Docker et Docker Compose installés sur le serveur, ou un déploiement Render avec PostgreSQL.

## Déploiement

1. Cloner le dépôt :
   `git clone https://github.com/HalileSow/JobHunter-AI.git`
   `cd JobHunter-AI`

2. Créer le fichier `.env` :
   `cp .env.example .env`
   Editer `.env` et définir les variables :
   - `JWT_SECRET`: Une chaîne de caractères forte et aléatoire.

3. Lancer l'application :
   `docker-compose up -d --build`

4. Exécuter les migrations de base de données :
   `docker-compose exec app npx knex migrate:latest --knexfile knexfile.cjs`

L'application sera accessible sur le port 4173.

## Déploiement Render

Le fichier `render.yaml` crée une base PostgreSQL gérée et injecte `DATABASE_URL` dans le service web.
En production, l'application utilise cette base au lieu de SQLite, ce qui évite les erreurs de binaire natif `sqlite3` liées à `glibc`.
