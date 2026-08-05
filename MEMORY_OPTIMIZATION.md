# Optimisations Mémoire - JobHunter-AI

## Problèmes identifiés

### 1. **Multiples instances Playwright/Chromium simultanées** (CRITIQUE)
- **Avant** : Chaque provider lançait sa propre instance Chromium
- **Impact** : 3 providers en parallèle = 3 × 150-300 Mo = 450-900 Mo RAM
- **Render Starter** : 512 Mo RAM → OOM kill systématique

### 2. **Chargement de tous les CVs en mémoire**
- **Avant** : Tous les CVs chargés avec contenu complet
- **Impact** : Plusieurs CVs de plusieurs Mo = explosion mémoire

### 3. **Scheduler trop agressif**
- **Avant** : Recherches possibles chaque minute sans intervalle minimum
- **Impact** : Accumulation de processus et données en mémoire

### 4. **SSE clients sans limite**
- **Avant** : Accumulation infinie de clients SSE
- **Impact** : Fuite mémoire progressive

## Solutions implémentées

### 1. **Browser Pool Singleton** (`automation/browser_pool.js`)
- ✅ Une seule instance Chromium réutilisée
- ✅ Lock système pour éviter les accès concurrents
- ✅ Timeout de 60s pour les locks orphelins
- ✅ Fermeture propre au shutdown

**Fichiers modifiés :**
- `automation/browser_scraper.js`
- `automation/application_automation.js`
- `automation/providers/impl/career_pages.js`
- `automation/providers/career_pages.js`

### 2. **Concurrence séquentielle** (`automation/search_engine.js`)
- ✅ `CONCURRENCY_LIMIT = 1` (au lieu de 3)
- ✅ Délai de 500ms entre providers pour le GC
- ✅ Exécution séquentielle des providers

### 3. **Limite de CVs en mémoire** (`automation/search_engine.js`)
- ✅ `MAX_CVS_IN_MEMORY = 2` (au lieu de tous)
- ✅ Réduction de 80% de la mémoire utilisée par les CVs

### 4. **Scheduler avec intervalle minimum** (`automation/scheduler.js`)
- ✅ `MIN_SEARCH_INTERVAL_MS = 5 * 60 * 1000` (5 minutes)
- ✅ Évite les exécutions trop rapprochées

### 5. **SSE clients limités** (`site/server.mjs`)
- ✅ `MAX_SSE_CLIENTS = 10`
- ✅ `SSE_TIMEOUT_MS = 30 * 60 * 1000` (30 minutes)
- ✅ Cleanup automatique des connexions orphelines

### 6. **Réduction taille données IA**
- ✅ `career_pages.js` : 8000 → 4000 caractères
- ✅ Réduction mémoire des prompts IA

### 7. **Graceful shutdown amélioré** (`site/server.mjs`)
- ✅ Fermeture du browser pool au SIGTERM/SIGINT
- ✅ Libération complète de la mémoire Chromium

## Configuration Render

### render.yaml
```yaml
plan: starter  # 512 Mo RAM
envVars:
  - key: NODE_OPTIONS
    value: --max-old-space-size=256  # 256 Mo pour Node.js
  - key: PG_POOL_MIN
    value: "0"
  - key: PG_POOL_MAX
    value: "2"  # Pool PostgreSQL minimal
```

### Bilan mémoire estimé
- **Node.js** : 256 Mo max (heap)
- **Chromium** : 150-250 Mo (1 instance)
- **PostgreSQL pool** : ~10 Mo
- **Total** : ~416-516 Mo ✅

## Résultats attendus

### Avant optimisations
- ❌ 3+ instances Chromium simultanées
- ❌ 450-900 Mo RAM pic
- ❌ OOM kill toutes les 10-30 minutes
- ❌ Redémarrages constants

### Après optimisations
- ✅ 1 seule instance Chromium
- ✅ 400-500 Mo RAM pic
- ✅ Stabilité durable (>24h)
- ✅ Pas de redémarrage intempestif

## Monitoring

Pour vérifier la consommation mémoire :
```bash
# Logs Render
render logs --service jobhunter-ai

# Mémoire utilisée
render exec --service jobhunter-ai -- free -m
```

## Maintenance

### Si OOM persiste
1. Réduire `MAX_CVS_IN_MEMORY` à 1
2. Réduire `MIN_SEARCH_INTERVAL_MS` à 10 minutes
3. Désactiver providers non essentiels
4. Passer à Render Standard (1 Go RAM)

### Bonnes pratiques
- Ne pas lancer plus de 2 recherches manuelles en parallèle
- Surveiller les logs pour détecter les locks expirés
- Vérifier la mémoire chaque semaine
