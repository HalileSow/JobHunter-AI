# Migration Render → Oracle Cloud Always Free

## Pourquoi OCI ?

| Critère | Render (Starter) | OCI (Always Free) |
|---|---|---|
| **RAM** | 512 MB | **24 GB** (ARM Ampere A1) |
| **CPU** | ? (partagé) | **4 OCPU** (Ampere ARM) |
| **Stockage** | Éphémère | **200 GB** block storage |
| **Base de données** | PostgreSQL géré (free) | PostgreSQL dans Docker |
| **Stabilité** | ❌ Redémarrages fréquents | ✅ Ressources largement suffisantes |
| **Coût** | 0$ (mais instable) | **0$** (et stable) |
| **Limite de trafic** | ? | **10 TB/mois** |

## Architecture sur OCI

```
┌─────────────────────────────────────────────────┐
│              VM Oracle Cloud (ARM)               │
│         4 OCPU · 24 GB RAM · Ubuntu 24.04        │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Caddy    │  │   App    │  │  PostgreSQL 16 │  │
│  │ (SSL/80)  │←→│(Node.js) │←→│  (Docker)      │  │
│  │ :443/:80  │  │ :4173    │  │  :5432         │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
│       │              │              │              │
│       │        ┌─────┴─────┐        │              │
│       │        │ Chromium  │        │              │
│       │        │(Playwright)│       │              │
│       │        └───────────┘       │              │
│       └────────────┬───────────────┘              │
│                    │                               │
│            duckdns.org (DNS gratuit)               │
└─────────────────────────────────────────────────┘
```

## Prérequis

### 1. Compte Oracle Cloud

1. Aller sur [https://signup.oraclecloud.com](https://signup.oraclecloud.com)
2. S'inscrire avec une carte bancaire (obligatoire, même pour le free tier — vérification seule)
3. Après validation, vous avez accès à la console OCI

### 2. Créer une VM Ampere A1 (ARM)

Dans la console OCI :

1. **Menu → Compute → Instances → Create instance**
2. **Nom** : `jobhunter-ai`
3. **Placement** : choisir un AD (Availability Domain) avec disponibilité Ampere
4. **Image** : Ubuntu 24.04 LTS (minimum)
5. **Shape** : `VM.Standard.A1.Flex`
   - **OCPU count** : 4 (max du free tier)
   - **Memory** : 24 GB (max du free tier)
6. **Add SSH keys** : coller votre clé publique (`~/.ssh/id_rsa.pub`)
7. **Boot volume** : 50 GB (par défaut, inclus dans les 200 GB free)
8. **Create**

> ⚠️ **Disponibilité** : Les instances Ampere peuvent être en rupture de stock dans certaines régions.
> Essayez `eu-frankfurt-1`, `eu-paris-1`, `eu-amsterdam-1`, `us-phoenix-1`, `ap-osaka-1`.
> En cas d'échec, réessayez quelques heures plus tard ou changez de région.

### 3. Ouvrir les ports (Security List)

1. **Menu → Networking → Virtual Cloud Networks → (votre VCN)**
2. Aller dans **Security Lists** → **Default Security List**
3. **Add Ingress Rules** :

| Source Type | Source | IP Protocol | Destination Port | Description |
|---|---|---|---|---|
| CIDR | `0.0.0.0/0` | TCP | `22` | SSH |
| CIDR | `0.0.0.0/0` | TCP | `80` | HTTP |
| CIDR | `0.0.0.0/0` | TCP | `443` | HTTPS |

### 4. (Optionnel) Réserver une IP publique statique

L'IP publique change au redémarrage de la VM. Pour éviter ça :

1. **Menu → Networking → Reserved Public IPs**
2. **Create Reserved Public IP** → nom : `jobhunter-ai`
3. **Menu → Compute → Instances → (votre instance) → Attached VNICs**
4. Cliquer sur le VNIC → **IP Addresses** → **Edit** → sélectionner l'IP réservée

## Procédure de migration

### Étape 1 : Provisionner la VM

```bash
# Depuis votre machine locale (Kali Linux)
cd /home/kali/JobHunter-AI

# Rendre les scripts exécutables
chmod +x scripts/oci-setup.sh scripts/oci-deploy.sh

# Copier le script sur la VM et l'exécuter
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> 'bash -s' < scripts/oci-setup.sh

# Se déconnecter puis reconnecter pour activer le groupe docker
exit
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI>
```
*Le script installe Docker, configure le pare-feu, le swap, et le block storage.*

### Étape 2 : Attacher un block storage (recommandé)

Pour les données persistantes supplémentaires (au-delà des 50 Go du boot volume) :

1. **Menu → Storage → Block Volumes → Create Block Volume**
2. **Taille** : 150 GB (inclus dans les 200 GB free)
3. **Attach** → **ISCSI** ou **Paravirtualized**
4. **Attach to instance** : sélectionner votre VM
5. Connecter le volume dans la VM :
   ```bash
   # Vérifier le device
   lsblk
   # Le script oci-setup.sh monte automatiquement /dev/oracleoci/oraclevdb sur /data
   ```

### Étape 3 : Configurer le DNS (duckdns.org)

Si vous utilisez déjà duckdns.org (actuellement `jobhunter-ai.duckdns.org`) :

1. Aller sur [https://www.duckdns.org](https://www.duckdns.org)
2. Mettre à jour l'enregistrement DNS :
   - **IP** : l'IP publique de votre VM OCI
3. Installer le cron de mise à jour automatique :
   ```bash
   ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI>
   
   # Créer le script de mise à jour DuckDNS
   mkdir -p ~/duckdns
   cat > ~/duckdns/duck.sh << 'DUCK'
   echo url="https://www.duckdns.org/update?domains=jobhunter-ai&token=VOTRE_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -s
   DUCK
   chmod +x ~/duckdns/duck.sh
   
   # Ajouter au crontab (toutes les 5 minutes)
   echo "*/5 * * * * ~/duckdns/duck.sh" | crontab -
   ```

### Étape 4 : Créer le fichier .env.oci

```bash
# Depuis votre machine locale (Kali Linux)
cd /home/kali/JobHunter-AI

# Créer le fichier .env.oci (ne pas committer, contient les secrets)
cat > .env.oci << 'ENVEOF'
# PostgreSQL
POSTGRES_USER=jobhunter
POSTGRES_PASSWORD=CHANGEZ_MOI_PASSWORD_FORT
POSTGRES_DB=jobhunter
DATABASE_URL=postgresql://jobhunter:CHANGEZ_MOI_PASSWORD_FORT@db:5432/jobhunter

# JWT (générer un nouveau secret)
JWT_SECRET=<GÉNÉRER_UN_SECRET>

# API Keys (reporter depuis Render)
ADZUNA_APP_ID=2ac72b16
ADZUNA_APP_KEY=ad51a04ff91d015a77033b8a8b1b180c
FRANCE_TRAVAIL_CLIENT_ID=PAR_jobhunterai_c8a81aaaa0b9bbd1f8a7ebd3baf6cbf0076817d205592a2184f682de705a6ef0
FRANCE_TRAVAIL_CLIENT_SECRET=53d30dc3fcbbd0d7dba39d484693785ef56536cda1f2fe6bb93dd71ce566e4e5

# Port
PORT=4173
ENVEOF

# Générer un JWT secret fort
JWT_SECRET=$(openssl rand -hex 64)
sed -i "s/JWT_SECRET=<GÉNÉRER_UN_SECRET>/JWT_SECRET=$JWT_SECRET/" .env.oci
```

### Étape 5 : Déployer l'application

```bash
# Depuis votre machine locale
chmod +x scripts/oci-deploy.sh
./scripts/oci-deploy.sh <IP_OCI>
```

Cela va :
1. Copier tous les fichiers du projet (sauf node_modules, .git, etc.)
2. Copier `.env.oci` → `.env` sur la VM
3. Build et lancer les containers Docker
4. Afficher les logs de démarrage

### Étape 6 : Vérifier le déploiement

```bash
# Vérifier que les containers tournent
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml ps'

# Voir les logs
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml logs -f app'

# Tester l'API health
curl http://<IP_OCI>:4173/api/health

# Exécuter les migrations si nécessaire
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml exec app npx knex migrate:latest --knexfile knexfile.cjs'
```

### Étape 7 : (Optionnel) Ancien domaine Render

Si vous voulez garder le même nom de domaine :

1. Aller sur [Render Dashboard](https://dashboard.render.com)
2. Settings → Custom Domain → supprimer le domaine
3. Mettre à jour duckdns.org avec la nouvelle IP OCI
4. Caddy détecte automatiquement le Let's Encrypt SSL

## Commandes utiles (post-déploiement)

```bash
# ── Logs ──
# App
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml logs -f --tail=100 app'

# Base de données
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml logs -f db'

# ── Redémarrage ──
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml restart app'

# ── Mise à jour (sans rebuild) ──
./scripts/oci-deploy.sh <IP_OCI> --no-build

# ── Shell dans le container app ──
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml exec app bash'

# ── Backup de la base de données ──
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml exec db pg_dump -U jobhunter jobhunter > /data/backup-$(date +%Y%m%d).sql'

# ── Restaurer un backup ──
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'cd ~/jobhunter-ai && docker compose -f docker-compose.oci.yml exec -T db psql -U jobhunter jobhunter' < backup-20250901.sql

# ── Surveiller la mémoire ──
ssh -i ~/.ssh/oci_key ubuntu@<IP_OCI> \
  'docker stats --no-stream'
```

## Sécurité

### Pare-feu (déjà configuré par oci-setup.sh)

```bash
# Vérifier
sudo ufw status verbose

# Ports ouverts : 22 (SSH), 80 (HTTP), 443 (HTTPS)
# Tout le reste est bloqué
```

### Mises à jour de sécurité auto

```bash
# Configurer les mises à jour automatiques
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Fail2ban (protection SSH)

```bash
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Désactiver Render (une fois OCI stable)

Une fois OCI opérationnel pendant 24h sans problème :

1. **Render Dashboard** → arrêter le service web
2. **Render Dashboard** → supprimer la base de données PostgreSQL
3. Mettre à jour votre DNS duckdns.org vers l'IP OCI

## Rollback (si nécessaire)

Si OCI pose problème :

1. **Render Dashboard** → redémarrer le service web
2. Re-pointer duckdns.org vers l'IP Render
3. Au pire, les données sont persistantes sur le block storage OCI

## FAQ

### Q : OCI risque de ne pas avoir de disponibilité Ampere ?

**R** : Oui, les instances Ampere sont très demandées. Essayez :
- Différentes régions (Francfort, Paris, Amsterdam, Osaka, Phoenix)
- Différents Availability Domains (AD-1, AD-2, AD-3)
- Réessayer à différents moments (heures creuses)
- Le script `oci-setup.sh` fonctionne aussi sur les micro instances AMD (1 GB RAM) en attendant

### Q : Puis-je utiliser les deux micro instances AMD (1 GB RAM) ?

**R** : Oui, mais c'est similaire à Render (512 MB × 2). Vous pouvez dédier une VM à la base de données et l'autre à l'app, mais l'ARM Ampere reste la meilleure option.

### Q : Que faire si l'IP change ?

**R** : Si vous n'avez pas réservé d'IP statique, l'IP publique change au redémarrage de la VM. Deux solutions :
1. Réserver une IP publique (recommandé, gratuit)
2. Mettre à jour duckdns.org automatiquement (le cron ci-dessus le fait)

### Q : Les données survivent-elles à un redémarrage ?

**R** : Oui, grâce au block storage attaché sur `/data`. PostgreSQL, Caddy et les données app sont sur des volumes Docker persistants.

### Q : Combien de temps prend la migration ?

**R** : Comptez 30 minutes si l'instance Ampere est disponible, plus si vous devez attendre la disponibilité.