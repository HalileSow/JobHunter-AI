# 🌍 Référentiel Mondial des API d'Emploi

> **Date de compilation :** 7 août 2026
> **Objectif :** Identifier les 30 meilleures API à intégrer dans JobHunter-AI pour couvrir l'Europe, le Canada et l'international.

---

## Légende du tableau

| Colonne | Description |
|---------|-------------|
| **Portail** | Nom du service d'emploi |
| **URL API** | Endpoint développeur |
| **Gratuit/Payant** | Modèle tarifaire |
| **Clé API** | Authentification requise |
| **Auth** | Type d'authentification |
| **Rate Limit** | Requêtes autorisées |
| **Postuler** | Candidature via API possible |
| **Récupérer** | Récupération d'offres possible |
| **Pays** | Zones géographiques couvertes |
| **Facilité** | Score d'intégration sur 10 |

---

## 🇪🇺 EUROPE

### Union Européenne — API Pan-Européennes

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **EURES** ( portail UE) | `https://ec.europa.eu/eures/public/` | Gratuit | Non | Aucune | Variable | Non | Oui | 32 pays UE/EEE | 7/10 |
| **Adzuna** | `https://developer.adzuna.com/` | Freemium | Oui | API Key | 250 req/jour (free) | Non | Oui | 14 pays (FR, DE, UK, NL, PL, AU, BR, CA, IN, NZ, RU, SG, US, ZA) | 9/10 |
| **Arbeitnow** | `https://documenter.getpostman.com/view/18530274/2s93bRZS` | Gratuit | Non | Aucune | Non documenté | Non | Oui | Europe (tech/remote) | 8/10 |
| **Jooble** | `https://jooble.org/api/` | Payant | Oui | API Key | Négociable | Non | Oui | 77 pays | 7/10 |
| **Careerjet** | `https://www.careerjet.co.uk/partners/api/` | Payant | Oui | API Key | Variable | Non | Oui | 81 pays | 6/10 |

### 🇫🇷 France

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **France Travail** (Pôle Emploi) | `https://api.francetravail.io/` | Gratuit | Oui | OAuth2 | 1000 req/jour | Non | Oui | France | 8/10 |
| **APEC** | `https://www.apec.fr/` | Gratuit | Non | Scraper | Variable | Non | Oui (RSS) | France | 6/10 |
| **RegionsJob** | `https://www.regionsjob.com/` | Payant | Oui | API Key | Négociable | Non | Oui | France (régional) | 5/10 |
| **HelloWork** | `https://www.hellowork.com/` | Gratuit | Non | Scraper | Variable | Non | Oui | France | 5/10 |
| **LesJeudis** | `https://www.lesjeudis.com/` | Gratuit | Non | Scraper | Variable | Non | Oui | France (tech) | 5/10 |

### 🇩🇪 Allemagne

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Bundesagentur für Arbeit** (Arbeitsamt) | `https://jobsuche.api.bund.dev/` | Gratuit | Non | Aucune | 100 req/min | Non | Oui | Allemagne | 9/10 |
| **StepStone Germany** | `https://www.stepstone.de/` | Payant | Oui | API Key | Négociable | Non | Oui | Allemagne | 5/10 |
| **XING** | `https://dev.xing.com/` | Payant | Oui | OAuth | Variable | Non | Oui | Allemagne/DACH | 6/10 |

### 🇬🇧 Royaume-Uni

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Reed** | `https://www.reed.co.uk/developers` | Freemium | Oui | API Key | 200 req/jour (free) | Non | Oui | Royaume-Uni | 8/10 |
| **FindaJob** (Gov UK) | `https://findajob.dwp.gov.uk/` | Gratuit | Non | Scraper | Variable | Non | Oui | Royaume-Uni | 6/10 |
| **DevITjobs UK** | `https://devitjobs.uk/job_feed.xml` | Gratuit | Non | Aucune (RSS/XML) | Non | Oui | Royaume-Uni (tech) | 9/10 |
| **Totaljobs** | `https://www.totaljobs.com/` | Payant | Oui | API Key | Négociable | Non | Oui | Royaume-Uni | 5/10 |
| **CV-Library** | `https://www.cv-library.co.uk/` | Payant | Oui | API Key | Négociable | Non | Oui | Royaume-Uni | 5/10 |

### 🇪🇸 Espagne

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **InfoJobs** | `https://developers.infojobs.net/` | Freemium | Oui | OAuth2 | 1000 req/jour | Oui | Oui | Espagne | 8/10 |
| **SEPE** (Serv. Público de Empleo) | `https://www.sepe.gob.es/` | Gratuit | Non | Scraper | Variable | Non | Oui | Espagne | 4/10 |
| **Trabajando.com** | `https://www.trabajando.com/` | Payant | Oui | API Key | Négociable | Non | Oui | Espagne/Amérique Latine | 5/10 |

### 🇮🇹 Italie

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **InfoJobs Italia** | `https://www.infojobs.it/` | Payant | Oui | API Key | Négociable | Non | Oui | Italie | 5/10 |
| **Subito Lavoro** | `https://www.subito.it/lavoro/` | Gratuit | Non | Scraper | Variable | Non | Oui | Italie | 4/10 |
| **Click Lavoro** | `https://www.clicklavoro.it/` | Gratuit | Non | Scraper | Variable | Non | Oui | Italie | 4/10 |

### 🇧🇪 Belgique

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Le Forem** | `https://www.leforem.be/` | Gratuit | Non | Scraper | Variable | Non | Oui | Wallonie | 4/10 |
| **Actiris** | `https://www.actiris.brussels/` | Gratuit | Non | Scraper | Variable | Non | Oui | Bruxelles | 4/10 |
| **VDAB** | `https://www.vdab.be/` | Gratuit | Non | Scraper | Variable | Non | Oui | Flandre | 4/10 |
| **Jobat.be** | `https://www.jobat.be/` | Payant | Oui | API Key | Négociable | Non | Oui | Belgique | 5/10 |

### 🇨🇭 Suisse

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **ORP/RAV** (Chômage fédéral) | `https://www.arbeit.swiss/` | Gratuit | Non | Scraper | Variable | Non | Oui | Suisse | 4/10 |
| **Jobup.ch** | `https://www.jobup.ch/` | Payant | Oui | API Key | Négociable | Non | Oui | Suisse romande | 5/10 |
| **Jobs.ch** | `https://www.jobs.ch/` | Payant | Oui | API Key | Négociable | Non | Oui | Suisse | 5/10 |

### 🇵🇹 Portugal

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **IEFP** | `https://www.iefp.pt/` | Gratuit | Non | Scraper | Variable | Non | Oui | Portugal | 4/10 |
| **Net-Empregos** | `https://www.net-empregos.com/` | Gratuit | Non | Scraper | Variable | Non | Oui | Portugal | 4/10 |

### 🇵🇱 Pologne

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Pracuj.pl** | `https://www.pracuj.pl/` | Payant | Oui | API Key | Négociable | Non | Oui | Pologne | 5/10 |
| **OLX Praca** | `https://pracuj.olx.pl/` | Payant | Oui | API Key | Négociable | Non | Oui | Pologne | 5/10 |

### 🇳🇱 Pays-Bas

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **UWV Werkbedrijf** | `https://www.werk.nl/` | Gratuit | Non | Scraper | Variable | Non | Oui | Pays-Bas | 5/10 |
| **Intermediair** | `https://www.intermediair.nl/` | Gratuit | Non | Scraper | Variable | Non | Oui | Pays-Bas | 4/10 |

### 🇸🇪 Suède / 🇳🇴 Norvège / 🇩🇰 Danemark

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Arbetsförmedlingen** | `https://api.arbetsformedlingen.se/` | Gratuit | Oui | API Key | 500 req/jour | Non | Oui | Suède | 7/10 |
| **NAV** (Norvège) | `https://www.nav.no/` | Gratuit | Non | Scraper | Variable | Non | Oui | Norvège | 4/10 |
| **Jobindex** | `https://www.jobindex.dk/` | Payant | Oui | API Key | Négociable | Non | Oui | Danemark | 6/10 |

### 🇦🇹 Autriche

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **AMS** (Arbeitsmarktservice) | `https://www.ams.at/` | Gratuit | Non | Scraper | Variable | Non | Oui | Autriche | 4/10 |

### 🇮🇪 Irlande

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **IrishJobs.ie** | `https://www.irishjobs.ie/` | Payant | Oui | API Key | Négociable | Non | Oui | Irlande | 5/10 |
| **Public Jobs** (Fonction publique) | `https://www.publicjobs.ie/` | Gratuit | Non | Scraper | Variable | Non | Oui | Irlande | 4/10 |

---

## 🌎 AMÉRIQUE DU NORD

### 🇨🇦 Canada

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Guichet-Emplois** (Job Bank) | `https://api.guichet-emplois.gc.ca/` | Gratuit | Non | Aucune (REST ouvert) | 100 req/min | Non | Oui | Canada | 9/10 |
| **Indeed Canada** | `https://www.indeed.com/publisher` | Freemium | Oui | API Key | Variable | Non | Oui | Canada (via Indeed Global) | 6/10 |
| **Jobillico** | `https://www.jobillico.com/` | Gratuit | Non | Scraper | Variable | Non | Oui | Canada (Québec) | 5/10 |
| **Talents.ca** | `https://www.talents.ca/` | Gratuit | Non | Scraper | Variable | Non | Oui | Canada | 4/10 |
| **Workopolis** | `https://www.workopolis.com/` | Payant | Oui | API Key | Négociable | Non | Oui | Canada | 5/10 |

### 🇺🇸 États-Unis

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **USAJOBS** | `https://developer.usajobs.gov/` | Gratuit | Oui | API Key | Variable | Non | Oui | États-Unis (fédéral) | 8/10 |
| **Indeed** | `https://www.indeed.com/publisher` | Freemium | Oui | API Key | 5000 req/jour | Non | Oui | 60+ pays | 7/10 |
| **ZipRecruiter** | `https://www.ziprecruiter.com/developers` | Payant | Oui | API Key | Négociable | Non | Oui | US/Global | 6/10 |
| **The Muse** | `https://www.themuse.com/api` | Payant | Oui | API Key | Variable | Non | Oui | États-Unis | 7/10 |
| **CareerBuilder** | `https://developer.careerbuilder.com/` | Payant | Oui | OAuth | 1000 req/jour | Oui | Oui | États-Unis | 6/10 |
| **Monster** | `https://monster.github.io/` | Payant | Oui | API Key | Négociable | Non | Oui | Global | 5/10 |
| **Google for Jobs** | Via Schema.org markup | Gratuit | Non | Scraping/indexation | Variable | Non | Oui (via SERP) | Global | 4/10 |
| **JSearch** (RapidAPI) | `https://jsearch.io/` | Freemium | Oui | API Key (RapidAPI) | 500 req/mois (free) | Non | Oui | Global (agrégateur) | 8/10 |

---

## 🌍 RESTE DU MONDE

### 🌐 Global / Remote-First

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Remotive** | `https://remotive.com/api/` | Gratuit | Non | Aucune | Variable | Non | Oui | Remote (global) | 9/10 |
| **We Work Remotely** | `https://weworkremotely.com/` | Gratuit | Non | RSS/XML | Non | Non | Oui | Remote (global) | 8/10 |
| **RemoteOK** | `https://remoteok.io/` | Gratuit | Non | JSON feed | Non | Non | Oui | Remote (global) | 8/10 |
| **Himalayas** | `https://himalayas.app/jobs.json` | Gratuit | Non | Aucune (JSON) | Non | Non | Oui | Remote (global) | 9/10 |
| **Open Sourced Jobs** | `https://www.opensourcedjobs.com/` | Gratuit | Non | Aucune | Variable | Non | Oui | Remote (tech) | 7/10 |
| **Working Nomads** | `https://www.workingnomads.com/jobs` | Gratuit | Non | RSS | Non | Non | Oui | Remote (global) | 7/10 |
| **Jobspresso** | `https://jobspresso.co/` | Gratuit | Non | RSS | Non | Non | Oui | Remote (global) | 7/10 |
| **Upwork** | `https://developers.upwork.com/` | Payant | Oui | OAuth | Variable | Oui | Oui | Freelance (global) | 7/10 |
| **Fiverr** | `https://developers.fiverr.com/` | Payant | Oui | OAuth | Variable | Non | Oui | Freelance (global) | 6/10 |
| **Toptal** | `https://www.toptal.com/` | Payant | Oui | API Key | Variable | Oui | Oui | Freelance (global) | 6/10 |
| **FlexJobs** | `https://www.flexjobs.com/` | Payant | Oui | API Key | Variable | Non | Oui | Remote (global) | 5/10 |
| **AngelList / Wellfound** | `https://wellfound.com/` | Gratuit | Non | Scraper | Variable | Non | Oui | Startups (global) | 5/10 |
| **Hiring.cool** | `https://hiring.cool/` | Gratuit | Non | Aucune | Variable | Non | Oui | Tech (global) | 7/10 |
| **Jobicy** | `https://jobicy.com/jobs-rss-feed` | Gratuit | Non | RSS | Non | Non | Oui | Remote (tech) | 7/10 |
| **Techmap Dev Jobs** | `https://techmap.io/dev-jobs-api` | Gratuit | Non | Aucune | Variable | Non | Oui | Tech (global) | 8/10 |
| **GitHub Jobs** | `https://jobs.github.com/` | **FERMÉ** | — | — | — | — | — | — | 0/10 |

### 🇦🇺 Australie / 🇳🇿 Nouvelle-Zélande

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Seek Australia** | `https://www.seek.com.au/` | Payant | Oui | API Key | Négociable | Non | Oui | AU/NZ | 5/10 |
| **Jora** | `https://www.jora.com/` | Payant | Oui | API Key | Négociable | Non | Oui | AU/Global | 6/10 |
| **TradeMe Jobs** | `https://www.trademe.co.nz/jobs` | Payant | Oui | API Key | Variable | Non | Oui | Nouvelle-Zélande | 6/10 |

### 🇯🇵 Japon

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Rikunabi** | `https://www.rikunabi.com/` | Payant | Oui | API Key | Négociable | Non | Oui | Japon | 4/10 |
| **Daijob** | `https://www.daijob.com/` | Payant | Oui | API Key | Négociable | Non | Oui | Japon (bilingue) | 5/10 |

### 🇧🇷 Brésil / Amérique Latine

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Catho** | `https://www.catho.com.br/` | Payant | Oui | API Key | Négociable | Non | Oui | Brésil | 5/10 |
| **Vagas.com** | `https://www.vagas.com.br/` | Payant | Oui | API Key | Négociable | Non | Oui | Brésil | 5/10 |
| **Computrabajo** | `https://www.computrabajo.com/` | Payant | Oui | API Key | Négociable | Non | Oui | Amérique Latine | 5/10 |

### 🇮🇳 Inde

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Naukri** | `https://www.naukri.com/` | Payant | Oui | API Key | Négociable | Non | Oui | Inde | 5/10 |
| **Cutshort** | `https://www.cutshort.io/` | Freemium | Oui | API Key | Variable | Oui | Oui | Inde (tech) | 7/10 |

### 🇿🇦 Afrique du Sud

| Portail | URL API | Gratuit/Payant | Clé API | Auth | Rate Limit | Postuler | Récupérer | Pays | Facilité |
|---------|---------|----------------|---------|------|------------|----------|-----------|------|----------|
| **Pnet** | `https://www.pnet.co.za/` | Payant | Oui | API Key | Négociable | Non | Oui | Afrique du Sud | 5/10 |
| **Careers24** | `https://www.careers24.com/` | Payant | Oui | API Key | Négociable | Non | Oui | Afrique du Sud | 5/10 |

---

## 🏆 TOP 30 — Meilleures API pour JobHunter-AI

### Critères de sélection

1. **Couverture géographique** : Europe + Canada prioritaires, puis international
2. **Gratuité ou Freemium** : Pas de coût ou faible coût
3. **Facilité d'intégration** : API REST, documentation claire
4. **Qualité des données** : Titre, entreprise, lieu, salaire, description
5. **Taux de réussite** : Disponibilité, stabilité, non-blocage

---

| # | API | Région | Type | Coût | Facilité | Pourquoi |
|---|-----|--------|------|------|----------|----------|
| 1 | **France Travail** | 🇫🇷 France | API officielle | Gratuit | 8/10 | API OAuth2 officielle, données structurées, déjà intégrée |
| 2 | **Adzuna** | 🌍 14 pays | Agrégateur | Freemium | 9/10 | Multi-pays, JSON propre, déjà intégrée |
| 3 | **Remotive** | 🌐 Remote global | API publique | Gratuit | 9/10 | JSON simple, remote-first, déjà intégrée |
| 4 | **Bundesagentur für Arbeit** | 🇩🇪 Allemagne | API officielle | Gratuit | 9/10 | API REST ouverte, documentation claire, pas de clé |
| 5 | **Guichet-Emplois** (Job Bank) | 🇨🇦 Canada | API officielle | Gratuit | 9/10 | API REST ouverte, JSON, pas de clé |
| 6 | **Arbeitnow** | 🇪🇺 Europe | API publique | Gratuit | 8/10 | Postman collection, remote Europe, pas de clé |
| 7 | **Reed** | 🇬🇧 Royaume-Uni | API officielle | Freemium | 8/10 | 200 req/jour gratuites, JSON |
| 8 | **InfoJobs** | 🇪🇸 Espagne | API officielle | Freemium | 8/10 | OAuth2, candidature via API |
| 9 | **DevITjobs UK** | 🇬🇧 UK (tech) | RSS/XML | Gratuit | 9/10 | Feed XML simple, pas d'auth |
| 10 | **Himalayas** | 🌐 Remote global | JSON feed | Gratuit | 9/10 | JSON direct, pas d'auth, données riches |
| 11 | **USAJOBS** | 🇺🇸 États-Unis | API officielle | Gratuit | 8/10 | API REST, documentation complète |
| 12 | **Arbetsförmedlingen** | 🇸🇪 Suède | API officielle | Gratuit | 7/10 | API Key, 500 req/jour |
| 13 | **We Work Remotely** | 🌐 Remote global | RSS | Gratuit | 8/10 | RSS simple, pas d'auth |
| 14 | **RemoteOK** | 🌐 Remote global | JSON feed | Gratuit | 8/10 | JSON direct, pas d'auth |
| 15 | **JSearch** (RapidAPI) | 🌐 Global | Agrégateur | Freemium | 8/10 | Agrège Indeed/LinkedIn/Glassdoor via RapidAPI |
| 16 | **Techmap Dev Jobs** | 🌐 Tech global | API publique | Gratuit | 8/10 | Tech-focused, pas d'auth |
| 17 | **Open Skills Jobs** | 🌐 Global | API ouverte | Gratuit | 8/10 | Open data, pas d'auth |
| 18 | **Hiring.cool** | 🌐 Tech global | API publique | Gratuit | 7/10 | Tech jobs, pas d'auth |
| 19 | **Jobicy** | 🌐 Remote tech | RSS | Gratuit | 7/10 | RSS feed, remote tech |
| 20 | **Upwork** | 🌐 Freelance | API officielle | Payant | 7/10 | OAuth, freelance marketplace |
| 21 | **Careerjet** | 🌍 81 pays | Agrégateur | Payant | 6/10 | Large couverture, mais payant |
| 22 | **Jooble** | 🌍 77 pays | Agrégateur | Payant | 7/10 | Très large couverture |
| 23 | **VDAB** | 🇧🇪 Flandre | Scraping | Gratuit | 4/10 | Pas d'API, scraping nécessaire |
| 24 | **Le Forem** | 🇧🇪 Wallonie | Scraping | Gratuit | 4/10 | Pas d'API, scraping nécessaire |
| 25 | **APEC** | 🇫🇷 France (cadres) | RSS | Gratuit | 6/10 | RSS feed, emplois cadres |
| 26 | **Jobindex** | 🇩🇰 Danemark | API | Payant | 6/10 | API disponible mais payante |
| 27 | **Working Nomads** | 🌐 Remote | RSS | Gratuit | 7/10 | RSS simple, remote jobs |
| 28 | **Jobspresso** | 🌐 Remote | RSS | Gratuit | 7/10 | RSS, remote tech |
| 29 | **Cutshort** | 🇮🇳 Inde (tech) | API | Freemium | 7/10 | Tech jobs Inde, candidature API |
| 30 | **AngelList / Wellfound** | 🌐 Startups | Scraping | Gratuit | 5/10 | Startups, pas d'API officielle |

---

## 📊 Résumé par zone géographique

| Zone | API gratuites | API payantes | API avec auth | Meilleure API |
|------|---------------|--------------|---------------|---------------|
| 🇪🇺 Europe (pan) | 4 | 2 | 2 | Adzuna (9/10) |
| 🇫🇷 France | 3 | 1 | 1 | France Travail (8/10) |
| 🇩🇪 Allemagne | 1 | 1 | 0 | Bundesagentur (9/10) |
| 🇬🇧 Royaume-Uni | 2 | 2 | 1 | DevITjobs UK (9/10) |
| 🇪🇸 Espagne | 1 | 2 | 1 | InfoJobs (8/10) |
| 🇧🇪 Belgique | 3 | 1 | 0 | VDAB (4/10 — scraping) |
| 🇨🇭 Suisse | 1 | 2 | 0 | Jobs.ch (5/10) |
| 🇵🇹 Portugal | 2 | 0 | 0 | IEFP (4/10 — scraping) |
| 🇸🇪 Suède | 1 | 0 | 1 | Arbetsförmedlingen (7/10) |
| 🇩🇰 Danemark | 0 | 1 | 1 | Jobindex (6/10) |
| 🇨🇦 Canada | 2 | 2 | 0 | Guichet-Emplois (9/10) |
| 🇺🇸 États-Unis | 2 | 4 | 2 | USAJOBS (8/10) |
| 🌐 Remote global | 8 | 2 | 0 | Himalayas (9/10) |
| 🌍 Agrégateurs globaux | 2 | 2 | 2 | JSearch (8/10) |

---

## 🔑 Synthèse des types d'authentification

| Type | APIs concernées | Complexité |
|------|-----------------|------------|
| **Aucune** (API ouverte) | Remotive, Arbeitnow, Himalayas, RemoteOK, DevITjobs, Techmap, Open Skills, Hiring.cool | ⭐ Très simple |
| **API Key** (header/query) | Adzuna, Reed, USAJOBS, Arbetsförmedlingen, JSearch | ⭐⭐ Simple |
| **OAuth2** | France Travail, InfoJobs, CareerBuilder, Upwork, Fiverr | ⭐⭐⭐ Modéré |
| **Scraper/No API** | APEC, VDAB, Le Forem, Actiris, AngelList | ⭐⭐⭐⭐ Complexe |

---

## 🎯 Recommandation d'intégration pour JobHunter-AI

### Phase 1 — Intégration immédiate (gratuit, pas/peu d'auth)

Ces API sont intégrables en quelques heures car elles ne nécessitent pas d'authentification ou très peu :

1. **Himalayas** — JSON direct, remote global
2. **RemoteOK** — JSON feed, remote global
3. **Arbeitnow** — Postman, Europe remote
4. **DevITjobs UK** — XML feed, UK tech
5. **We Work Remotely** — RSS, remote global
6. **Techmap Dev Jobs** — API ouverte, tech global
7. **Open Skills Jobs** — Open data, global
8. **Jobicy** — RSS, remote tech
9. **Hiring.cool** — API ouverte, tech global
10. **Working Nomads** — RSS, remote

### Phase 2 — Intégration rapide (API Key gratuite)

Nécessite une inscription pour obtenir une clé API :

11. **Bundesagentur für Arbeit** — Allemagne, pas de clé nécessaire
12. **Guichet-Emplois** — Canada, pas de clé nécessaire
13. **Adzuna** — 14 pays, clé gratuite (déjà intégré)
14. **Reed** — UK, clé gratuite (200 req/jour)
15. **Arbetsförmedlingen** — Suède, clé gratuite
16. **JSearch** — Agrégateur global, clé RapidAPI gratuite
17. **USAJOBS** — US fédéral, clé gratuite (déjà référencé)

### Phase 3 — Intégration modérée (OAuth2 ou payant)

Nécessite un flux d'authentification ou un contrat :

18. **France Travail** — OAuth2 (déjà intégré)
19. **InfoJobs** — OAuth2, Espagne
20. **CareerBuilder** — OAuth, US
21. **Upwork** — OAuth, freelance

### Phase 4 — Scraping (complexe, maintenance)

Pas d'API officielle, scraping navigateur requis :

22. **VDAB** — Belgique Flandre
23. **Le Forem** — Belgique Wallonie
24. **Actiris** — Belgique Bruxelles
25. **APEC** — France cadres
26. **AngelList/Wellfound** — Startups

---

## ⚠️ Notes importantes

- **GitHub Jobs API** : **FERMÉE** en 2023. Ne pas intégrer.
- **LinkedIn Jobs API** : **TRÈS RESTRAINTE**. L'accès API officiel est limité aux partenaires. Le scraping est la seule option viable, mais contre les CGU.
- **Indeed API** : L'API Publisher existe mais est en transition vers Indeed Apply. Le scraping reste l'approche principale.
- **Glassdoor** : Pas d'API publique. Scraping uniquement (contre les CGU).
- **Monster** : API existante mais partenariat requis.
- **ZipRecruiter** : API payante, contrat nécessaire.

---

## 📈 Couverture estimée avec le TOP 30

| Métrique | Valeur |
|----------|--------|
| **Pays couverts** | 40+ pays |
| **Offres estimées** | 500 000+ offres uniques |
| **API gratuites** | 22 sur 30 |
| **API avec auth simple** | 5 sur 30 |
| **API avec OAuth** | 3 sur 30 |
| **Scraping requis** | 5 sur 30 |
| **Coût mensuel estimé** | 0€ (si on reste sur les APIs gratuites/freemium) |

---

*Document généré le 7 août 2026 pour JobHunter-AI*
