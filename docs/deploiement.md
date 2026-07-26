# Déploiement de JobHunter-AI

## État actuel

L’application est prête à être exécutée dans un conteneur unique : interface web Express, automatisation, SQLite et fichiers PDF. Le point de santé est disponible sur `/api/health`.

## Lancement local

1. Copier `.env.example` vers `.env` et renseigner les clés autorisées.
2. Installer les dépendances avec `npm ci` dans `automation/` puis dans `site/`.
3. Lancer `npm start` depuis `site/`.
4. Ouvrir `http://localhost:4173`.

## Docker

Construire puis exécuter l’image :

```bash
docker build -t jobhunter-ai .
docker run --env-file .env -p 4173:4173 -v jobhunter-data:/app/database jobhunter-ai
```

Le volume est indispensable : il conserve la base SQLite entre les redémarrages. Les lettres PDF restent dans le conteneur ; ajouter également un volume sur `/app/cover_letters/generated` pour les conserver.

## Railway ou Render

Créer un service web à partir du dépôt, utiliser le `Dockerfile`, définir les variables de `.env` dans le tableau de bord du fournisseur et publier le port `4173` (ou la variable `PORT` fournie par le fournisseur). Configurer la vérification de santé sur `/api/health`.

Pour SQLite, le fournisseur doit fournir un disque persistant monté sur `/app/database` et, idéalement, `/app/cover_letters/generated`. Sans disque persistant, les offres et documents seront perdus après un redéploiement.

## Passage à PostgreSQL et authentification

La base locale est volontairement SQLite. Avant un déploiement multi-utilisateur public, la prochaine migration doit introduire PostgreSQL, les comptes utilisateurs, les sessions sécurisées et l’isolement des données par utilisateur. Ne pas exposer l’instance actuelle sur Internet sans cette étape : elle est conçue pour un usage personnel/local.
