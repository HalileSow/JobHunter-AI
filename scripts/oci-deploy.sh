#!/bin/bash
# =============================================================================
# oci-deploy.sh — Déploiement de JobHunter-AI sur Oracle Cloud
# =============================================================================
# Usage :
#   1. Provisionner la VM OCI avec oci-setup.sh (une seule fois)
#   2. Créer un fichier .env.oci avec vos secrets
#   3. Lancer ce script :
#        ./scripts/oci-deploy.sh <IP_OCI> [--no-build]
#
# Options :
#   --no-build    Re-déploie sans rebuild (copie et docker compose up -d)
# =============================================================================

set -euo pipefail

OCI_IP="${1:-}"
if [ -z "$OCI_IP" ]; then
    echo "Usage: $0 <IP_OCI> [--no-build]"
    echo "Exemple: $0 129.146.xxx.xxx"
    exit 1
fi

NO_BUILD=false
if [ "${2:-}" = "--no-build" ]; then
    NO_BUILD=true
fi

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
SSH_USER="${SSH_USER:-ubuntu}"
REMOTE_DIR="/home/ubuntu/jobhunter-ai"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "🚀 Déploiement de JobHunter-AI vers OCI ($OCI_IP)..."

# ── 1. Vérifier la connexion SSH ──
echo "🔍 Test de connexion SSH..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@$OCI_IP" "echo '✓ Connexion OK'"

# ── 2. Créer le dossier distant ──
ssh -i "$SSH_KEY" "$SSH_USER@$OCI_IP" "mkdir -p $REMOTE_DIR"

# ── 3. Copier les fichiers du projet (via tar + ssh pour la vitesse) ──
echo "📦 Copie des fichiers du projet..."
# Liste d'exclusion
cat > /tmp/rsync-exclude.txt << 'EOF'
.git/
node_modules/
automation/node_modules/
site/node_modules/
database/*.db
database/*.db-journal
database/*.db-wal
.env
.env.*
cover_letters/generated/
*.log
EOF

rsync -avz --delete \
    --exclude-from=/tmp/rsync-exclude.txt \
    -e "ssh -i $SSH_KEY" \
    "$LOCAL_DIR/" \
    "$SSH_USER@$OCI_IP:$REMOTE_DIR/"

rm -f /tmp/rsync-exclude.txt

# ── 4. Copier le fichier .env.oci → .env sur la VM ──
if [ -f "$LOCAL_DIR/.env.oci" ]; then
    echo "🔑 Copie du fichier .env.oci..."
    scp -i "$SSH_KEY" "$LOCAL_DIR/.env.oci" "$SSH_USER@$OCI_IP:$REMOTE_DIR/.env"
else
    echo "⚠️  Aucun fichier .env.oci trouvé. Utilisation du .env existant (si présent)."
fi

# ── 5. Déploiement Docker ──
if [ "$NO_BUILD" = true ]; then
    echo "♻️  Re-déploiement sans rebuild..."
    ssh -i "$SSH_KEY" "$SSH_USER@$OCI_IP" \
        "cd $REMOTE_DIR && docker compose -f docker-compose.oci.yml up -d"
else
    echo "🐳 Build et déploiement Docker..."
    ssh -i "$SSH_KEY" "$SSH_USER@$OCI_IP" \
        "cd $REMOTE_DIR && docker compose -f docker-compose.oci.yml up -d --build"
fi

# ── 6. Vérification ──
echo "⏳ Attente du démarrage..."
sleep 5

echo "📋 Statut des containers :"
ssh -i "$SSH_KEY" "$SSH_USER@$OCI_IP" \
    "cd $REMOTE_DIR && docker compose -f docker-compose.oci.yml ps"

echo "📊 Logs récents :"
ssh -i "$SSH_KEY" "$SSH_USER@$OCI_IP" \
    "cd $REMOTE_DIR && docker compose -f docker-compose.oci.yml logs --tail=20 app"

echo ""
echo "✅ Déploiement terminé sur http://$OCI_IP"
echo "    (SSL actif une fois le DNS pointé vers cette IP)"
echo ""
echo "Commandes utiles :"
echo "  Logs app :  ssh -i $SSH_KEY $SSH_USER@$OCI_IP 'cd $REMOTE_DIR && docker compose -f docker-compose.oci.yml logs -f app'"
echo "  Logs db :   ssh -i $SSH_KEY $SSH_USER@$OCI_IP 'cd $REMOTE_DIR && docker compose -f docker-compose.oci.yml logs -f db'"
echo "  Shell :     ssh -i $SSH_KEY $SSH_USER@$OCI_IP"
echo "  Migrations : ssh -i $SSH_KEY $SSH_USER@$OCI_IP 'cd $REMOTE_DIR && docker compose -f docker-compose.oci.yml exec app npx knex migrate:latest --knexfile knexfile.cjs'"