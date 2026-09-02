#!/bin/bash
# =============================================================================
# oci-setup.sh — Provisionnement d'une VM Oracle Cloud (Always Free ARM Ampere)
# =============================================================================
# Ce script s'exécute UNE FOIS sur la VM OCI fraîchement créée.
# À exécuter en SSH après la création de l'instance :
#   ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> 'bash -s' < scripts/oci-setup.sh
#
# Prérequis OCI (à faire depuis la console web) :
#   1. Créer une VM Ampere A1 (VM.Standard.A1.Flex) — Ubuntu 24.04 LTS
#   2. Ouvrir les ports 80, 443, 22 dans le Security List / NSG
#   3. Ajouter sa clé SSH publique
#   4. (Optionnel) Réserver une IP publique statique (ephemeral → reserved)
# =============================================================================

set -euo pipefail

echo "=== 1. Mise à jour du système ==="
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get autoremove -y -qq

echo "=== 2. Installation de Docker & Docker Compose ==="
# Docker Engine (pas Docker Desktop)
sudo apt-get install -y -qq ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Ajouter ubuntu au groupe docker (évite sudo)
sudo usermod -aG docker ubuntu

echo "=== 3. Configuration du pare-feu (ufw) ==="
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Caddy)
sudo ufw allow 443/tcp   # HTTPS (Caddy)
sudo ufw --force enable

echo "=== 4. Swap (sécurité pour les pics mémoire) ==="
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

echo "=== 5. Montage du block storage (si attaché) ==="
# OCI permet d'attacher jusqu'à 200 GB de block storage gratuit
BLOCK_DEVICE="/dev/oracleoci/oraclevdb"
if [ -b "$BLOCK_DEVICE" ]; then
    echo "Block storage détecté sur $BLOCK_DEVICE"
    # Formater si non formaté
    if ! blkid "$BLOCK_DEVICE" > /dev/null 2>&1; then
        sudo mkfs.ext4 "$BLOCK_DEVICE"
    fi
    # Monter
    sudo mkdir -p /data
    if ! mount | grep -q "/data"; then
        sudo mount "$BLOCK_DEVICE" /data
        echo "$BLOCK_DEVICE /data ext4 defaults,_netdev,nofail 0 2" | sudo tee -a /etc/fstab
    fi
    # Créer les dossiers de données persistantes
    sudo mkdir -p /data/postgres /data/app /data/caddy
    sudo chown -R ubuntu:docker /data
else
    echo "⚠️  Aucun block storage attaché. Les données seront sur le disque racine (80 Go)."
    mkdir -p /tmp/data/postgres /tmp/data/app /tmp/data/caddy
fi

echo "=== 6. Réglages sysctl pour la production ==="
cat << 'SYSCTL' | sudo tee /etc/sysctl.d/99-jobhunter.conf
# Réduire les timeouts (important pour les providers API)
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
# Limites de fichiers (nécessaire pour SQLite + SSE)
fs.file-max = 100000
# Pire cas mémoire (swap sous pression)
vm.swappiness = 10
SYSCTL
sudo sysctl -p /etc/sysctl.d/99-jobhunter.conf

echo "=== 7. Vérification ==="
echo "--- Docker ---"
docker --version
docker compose version
echo "--- Services ---"
sudo systemctl status docker --no-pager | head -5
echo "--- Swap ---"
swapon --show
echo "--- UFW ---"
sudo ufw status verbose

echo ""
echo "✅ Provisionnement terminé !"
echo "Déconnectez-vous puis reconnectez-vous pour que le groupe docker prenne effet."
echo "Ensuite, déployez l'application depuis votre machine locale :"
echo "  ./scripts/oci-deploy.sh <IP_OCI>"