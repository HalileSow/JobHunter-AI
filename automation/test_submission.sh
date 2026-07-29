#!/bin/bash
cd /home/kali/JobHunter-AI/automation

# Sauvegarde config originale
cp ../config/search_config.json ../config/search_config.json.bak
echo '{"search": {"default_providers": ["example_provider"]}}' > ../config/search_config.json

node mock_site.js &
MOCK_PID=$!
sleep 2

# Exécution du workflow
NODE_ENV=production node main.js "Allemagne" "Développeur" "Node.js"

# Vérification (simple)
echo "Vérification en base de données..."
# Ceci est un test très simplifié qui nécessite SQLite ou Postgres
# Comme on a Postgres dans Docker, on pourrait utiliser psql, 
# mais pour l'instant je vais juste vérifier si des fichiers ont été générés.

echo "Vérification des lettres générées :"
ls -l ../cover_letters/generated/

# Restauration config
mv ../config/search_config.json.bak ../config/search_config.json
kill $MOCK_PID
