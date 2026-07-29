#!/bin/bash
# Script de démarrage pour JobHunter-AI

# Vérification de la version Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "Utilisation de docker-compose"
    DOCKER_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    echo "Utilisation de docker compose"
    DOCKER_CMD="docker compose"
else
    echo "Erreur: Docker Compose non trouvé."
    exit 1
fi

$DOCKER_CMD up --build
