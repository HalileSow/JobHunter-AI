const SITE_NAME = 'JobHunter-AI';

const localeHomePages = [
    {
        locale: 'fr',
        path: '/',
        title: 'JobHunter-AI | Recherche d’emploi intelligente',
        description: 'JobHunter-AI aide les candidats à trouver plus vite des offres d’emploi, à suivre leurs recherches et à préparer CV, lettres et candidatures avec l’IA.',
        h1: 'Trouvez un emploi avec une recherche pilotée par l’IA',
        intro: 'JobHunter-AI centralise la recherche d’offres, l’analyse des annonces et la préparation de candidature pour vous aider à gagner du temps sans perdre le contrôle.',
        heroPoints: [
            'Recherche multi-sources et multi-pays',
            'Analyse des offres et score de correspondance',
            'CV, lettres et préparation de candidature',
            'Recherches planifiées et notifications'
        ],
        sections: [
            {
                title: 'Une plateforme utile pour la recherche d’emploi',
                paragraphs: [
                    'Vous cherchez un emploi en France, en Europe ou à l’étranger ? JobHunter-AI explore plusieurs sources d’offres, compare les annonces et met en avant celles qui correspondent à votre profil.',
                    'La plateforme aide aussi à préparer un dossier de candidature cohérent avec votre expérience, votre CV et vos préférences de mobilité.'
                ]
            },
            {
                title: 'Ce que vous pouvez faire',
                bullets: [
                    'Lancer une recherche par métier, pays, ville, contrat ou niveau d’expérience.',
                    'Suivre des recherches planifiées pour recevoir les nouvelles offres automatiquement.',
                    'Préparer des lettres de motivation et des versions de CV adaptées.',
                    'Suivre les candidatures, les statuts et l’historique des recherches.'
                ]
            },
            {
                title: 'Pensé pour le mobile et le futur mobile',
                paragraphs: [
                    'Le site est préparé pour une utilisation confortable sur téléphone et tablette, avec une base technique compatible avec une future application mobile réutilisant le même backend.',
                    'L’architecture actuelle facilite une évolution vers PWA, Capacitor ou un client mobile natif sans réécrire la logique métier.'
                ]
            }
        ],
        related: [
            { label: 'Offres d’emploi', href: '/offres-emploi' },
            { label: 'Recherche avec IA', href: '/recherche-emploi-avec-ia' },
            { label: 'CV IA', href: '/cv-ia' },
            { label: 'Lettre de motivation IA', href: '/lettre-motivation-ia' }
        ],
        alternates: [
            { hreflang: 'fr', href: '/' },
            { hreflang: 'en', href: '/en' },
            { hreflang: 'de', href: '/de' },
            { hreflang: 'it', href: '/it' },
            { hreflang: 'x-default', href: '/' }
        ]
    },
    {
        locale: 'en',
        path: '/en',
        title: 'JobHunter-AI | AI job search platform',
        description: 'JobHunter-AI helps candidates search jobs across multiple sources, track applications, and prepare CVs and cover letters with AI.',
        h1: 'Find jobs faster with AI-assisted search',
        intro: 'JobHunter-AI brings together job discovery, offer analysis, and application preparation so job seekers can search smarter and stay organised.',
        heroPoints: [
            'Multi-source and multi-country searches',
            'Offer analysis and fit scoring',
            'CV and cover letter support',
            'Scheduled searches and notifications'
        ],
        sections: [
            {
                title: 'Built for practical job search',
                paragraphs: [
                    'Whether you are looking for work locally or abroad, the platform helps you compare opportunities, shortlist relevant offers, and keep your search process structured.',
                    'The same backend powers search automation, profile management, and application workflows.'
                ]
            },
            {
                title: 'What it supports today',
                bullets: [
                    'Search by role, country, city, contract type, or experience level.',
                    'Analyse offers and highlight the most relevant matches.',
                    'Prepare cover letters and CV variants for different applications.',
                    'Keep scheduled searches running in the background.'
                ]
            }
        ],
        related: [
            { label: 'Job search in Europe', href: '/emploi-europe' },
            { label: 'AI job search', href: '/recherche-emploi-avec-ia' },
            { label: 'AI CV generator', href: '/cv-ia' }
        ],
        alternates: [
            { hreflang: 'fr', href: '/' },
            { hreflang: 'en', href: '/en' },
            { hreflang: 'de', href: '/de' },
            { hreflang: 'it', href: '/it' },
            { hreflang: 'x-default', href: '/' }
        ]
    },
    {
        locale: 'de',
        path: '/de',
        title: 'JobHunter-AI | KI-gestützte Jobsuche',
        description: 'JobHunter-AI unterstützt Kandidaten bei der Suche nach Stellen, der Analyse von Jobangeboten und der Vorbereitung von Bewerbungen mit KI.',
        h1: 'Jobs schneller finden mit KI-Unterstützung',
        intro: 'JobHunter-AI bündelt Jobsuche, Angebotsanalyse und Bewerbungsunterlagen in einer klaren, mobilen Weboberfläche.',
        heroPoints: [
            'Suche über mehrere Quellen und Länder',
            'Analyse von Stellenanzeigen',
            'Lebenslauf- und Anschreiben-Unterstützung',
            'Geplante Suche und Benachrichtigungen'
        ],
        sections: [
            {
                title: 'Für eine strukturierte Jobsuche gebaut',
                paragraphs: [
                    'Die Plattform hilft dabei, passende Stellen zu erkennen, Suchläufe zu wiederholen und die Bewerbungsarbeit zu vereinfachen.',
                    'Die Architektur ist auf eine spätere mobile App vorbereitet, die denselben sicheren Backend-Stack nutzt.'
                ]
            }
        ],
        related: [
            { label: 'Jobs in Deutschland', href: '/emploi-allemagne' },
            { label: 'AI Bewerbung', href: '/recherche-emploi-avec-ia' }
        ],
        alternates: [
            { hreflang: 'fr', href: '/' },
            { hreflang: 'en', href: '/en' },
            { hreflang: 'de', href: '/de' },
            { hreflang: 'it', href: '/it' },
            { hreflang: 'x-default', href: '/' }
        ]
    },
    {
        locale: 'it',
        path: '/it',
        title: 'JobHunter-AI | Ricerca lavoro con IA',
        description: 'JobHunter-AI aiuta i candidati a cercare lavoro, analizzare le offerte e preparare CV e lettere di presentazione con l’intelligenza artificiale.',
        h1: 'Trova lavoro più velocemente con l’IA',
        intro: 'JobHunter-AI riunisce ricerca multi-sorgente, analisi delle offerte e preparazione delle candidature in un’unica esperienza web.',
        heroPoints: [
            'Ricerca su più fonti e paesi',
            'Analisi delle offerte e punteggio di compatibilità',
            'Supporto per CV e lettera di presentazione',
            'Ricerca pianificata e notifiche'
        ],
        sections: [
            {
                title: 'Pronto per una crescita internazionale',
                paragraphs: [
                    'La base tecnica permette di aggiungere progressivamente nuove lingue e nuove pagine localizzate senza rifare il backend.',
                    'L’obiettivo è mantenere un’unica logica di ricerca, di analisi e di candidatura per web e mobile.'
                ]
            }
        ],
        related: [
            { label: 'Lavoro in Europa', href: '/emploi-europe' },
            { label: 'CV IA', href: '/cv-ia' }
        ],
        alternates: [
            { hreflang: 'fr', href: '/' },
            { hreflang: 'en', href: '/en' },
            { hreflang: 'de', href: '/de' },
            { hreflang: 'it', href: '/it' },
            { hreflang: 'x-default', href: '/' }
        ]
    }
];

const intentPages = [
    {
        path: '/emploi',
        title: 'Emploi avec JobHunter-AI',
        description: 'Une page d’entrée pour découvrir comment JobHunter-AI simplifie la recherche d’emploi, l’analyse des offres et la préparation des candidatures.',
        h1: 'Recherche d’emploi simplifiée',
        intro: 'Pour une première recherche ou une reprise de recherche, JobHunter-AI aide à structurer les offres, les candidatures et les rappels.',
        sections: [
            {
                title: 'À quoi sert cette page',
                paragraphs: [
                    'Cette page sert de point d’entrée pour les visiteurs qui cherchent une solution pratique pour organiser leur recherche d’emploi.',
                    'Elle renvoie vers les pages dédiées aux intentions plus précises.'
                ]
            }
        ],
        related: [
            { label: 'Offres d’emploi', href: '/offres-emploi' },
            { label: 'Recherche avec IA', href: '/recherche-emploi-avec-ia' }
        ]
    },
    {
        path: '/offres-emploi',
        title: 'Offres d’emploi analysées par JobHunter-AI',
        description: 'Explorez une recherche d’offres d’emploi multi-sources, filtrée et analysée par l’IA pour mieux repérer les opportunités pertinentes.',
        h1: 'Offres d’emploi plus faciles à trier',
        intro: 'JobHunter-AI compare des offres provenant de plusieurs sources et met en avant les annonces les plus utiles selon votre profil.',
        sections: [
            {
                title: 'Pourquoi cette page existe',
                bullets: [
                    'Centraliser plusieurs sources d’offres.',
                    'Faciliter le tri par pertinence.',
                    'Préparer une candidature plus rapide.'
                ]
            }
        ],
        related: [
            { label: 'Emploi sans expérience', href: '/emploi-sans-experience' },
            { label: 'Emploi en Europe', href: '/emploi-europe' }
        ]
    },
    {
        path: '/emploi-europe',
        title: 'Emploi en Europe avec JobHunter-AI',
        description: 'Une page dédiée à la recherche d’emploi en Europe, avec un suivi par pays et une préparation de candidature cohérente.',
        h1: 'Chercher un emploi en Europe',
        intro: 'La plateforme accompagne les candidatures transfrontalières en gardant une logique unique de recherche et de suivi.',
        sections: [
            {
                title: 'Utilité',
                paragraphs: [
                    'Cette page est utile pour les candidats qui visent plusieurs marchés européens et veulent conserver un seul workflow de recherche.',
                    'Elle prépare l’ajout futur de variantes localisées plus détaillées.'
                ]
            }
        ],
        related: [
            { label: 'Emploi en France', href: '/emploi-france' },
            { label: 'Emploi au Luxembourg', href: '/emploi-luxembourg' }
        ]
    },
    {
        path: '/emploi-france',
        title: 'Emploi en France',
        description: 'Trouver un emploi en France avec une recherche structurée, des alertes et une préparation de candidature assistée par IA.',
        h1: 'Emploi en France',
        intro: 'Cette page cible les recherches en France et permet de relier les offres à votre profil, vos filtres et vos candidatures.',
        sections: [
            { title: 'Ce que vous y gagnez', bullets: ['Un point d’entrée dédié.', 'Des recherches réutilisables.', 'Une base claire pour les futurs filtres locaux.'] }
        ],
        related: [
            { label: 'Offres d’emploi', href: '/offres-emploi' },
            { label: 'Emploi sans diplôme', href: '/emploi-sans-diplome' }
        ]
    },
    {
        path: '/emploi-luxembourg',
        title: 'Emploi au Luxembourg',
        description: 'Trouver un emploi au Luxembourg avec des recherches ciblées, le suivi des offres et des outils de candidature assistés par IA.',
        h1: 'Emploi au Luxembourg',
        intro: 'Une page utile pour les candidatures au Luxembourg, à connecter ensuite à des offres et filtres localisés.',
        sections: [{ title: 'Orientation', paragraphs: ['Prépare l’indexation par pays et l’ajout de contenus localisés quand les données réelles seront disponibles.'] }],
        related: [{ label: 'Emploi en Belgique', href: '/emploi-belgique' }]
    },
    {
        path: '/emploi-allemagne',
        title: 'Emploi en Allemagne',
        description: 'Une page d’orientation pour la recherche d’emploi en Allemagne, pensée pour l’indexation et l’expansion multilingue.',
        h1: 'Emploi en Allemagne',
        intro: 'Cette page accompagne la montée en puissance de l’internationalisation du site.',
        sections: [{ title: 'Orientation', paragraphs: ['Le contenu reste unique et utile, sans inventer d’offres.'] }],
        related: [{ label: 'Emploi en Autriche', href: '/emploi-autriche' }]
    },
    {
        path: '/emploi-autriche',
        title: 'Emploi en Autriche',
        description: 'Préparation SEO pour les recherches liées à l’emploi en Autriche et aux futures pages localisées.',
        h1: 'Emploi en Autriche',
        intro: 'Une base simple pour des contenus localisés et des offres réelles plus tard.',
        sections: [{ title: 'Orientation', bullets: ['Page publique indexable.', 'Contenu sobre et pertinent.', 'Pas de fausses annonces.'] }]
    },
    {
        path: '/emploi-italie',
        title: 'Emploi en Italie',
        description: 'Préparation SEO pour les visiteurs qui recherchent un emploi en Italie et veulent suivre leurs candidatures depuis JobHunter-AI.',
        h1: 'Emploi en Italie',
        intro: 'Cette page permet de couvrir les recherches liées au marché italien avant l’ajout de contenus plus détaillés.',
        sections: [{ title: 'Orientation', paragraphs: ['Le site reste cohérent et prêt à accueillir des contenus réels par pays.'] }]
    },
    {
        path: '/emploi-belgique',
        title: 'Emploi en Belgique',
        description: 'Page de transition pour la recherche d’emploi en Belgique, utile pour l’architecture SEO et l’évolution internationale.',
        h1: 'Emploi en Belgique',
        intro: 'Une page courte mais utile pour structurer le maillage interne et le futur contenu local.',
        sections: [{ title: 'Orientation', paragraphs: ['Page d’atterrissage simple, sans duplication artificielle.'] }]
    },
    {
        path: '/emploi-pays-bas',
        title: 'Emploi aux Pays-Bas',
        description: 'Préparation SEO pour les recherches d’emploi aux Pays-Bas et les futures pages localisées du site.',
        h1: 'Emploi aux Pays-Bas',
        intro: 'Cette page aide à préparer la visibilité sur les requêtes liées au marché néerlandais.',
        sections: [{ title: 'Orientation', paragraphs: ['Le contenu est volontairement sobre et évolutif.'] }]
    },
    {
        path: '/emploi-sans-diplome',
        title: 'Emploi sans diplôme',
        description: 'Une page utile pour les candidats qui cherchent un emploi sans diplôme et souhaitent repérer rapidement les offres adaptées.',
        h1: 'Emploi sans diplôme',
        intro: 'JobHunter-AI peut aider à repérer les offres accessibles selon l’expérience, les compétences et la mobilité.',
        sections: [
            { title: 'Conseils utiles', bullets: ['Cibler les métiers accessibles.', 'Filtrer par contrat et horaires.', 'Suivre les offres récentes automatiquement.'] }
        ],
        related: [
            { label: 'Emploi sans expérience', href: '/emploi-sans-experience' },
            { label: 'Travail en usine', href: '/travail-en-usine' }
        ]
    },
    {
        path: '/emploi-sans-experience',
        title: 'Emploi sans expérience',
        description: 'Trouver un emploi sans expérience avec des recherches filtrées, des recommandations et une préparation de candidature simple.',
        h1: 'Emploi sans expérience',
        intro: 'Cette page cible les recherches débutantes et les premières candidatures, avec un parcours clair vers les offres pertinentes.',
        sections: [{ title: 'Ce qu’elle couvre', bullets: ['Postes débutants.', 'Recherche par pays.', 'Aide à la candidature.'] }]
    },
    {
        path: '/travail-en-usine',
        title: 'Travail en usine',
        description: 'Rechercher du travail en usine, des postes d’ouvrier, d’agent de production ou de manutentionnaire avec une approche structurée.',
        h1: 'Travail en usine',
        intro: 'Une page pensée pour les requêtes liées à la production, la manutention et les postes opérationnels.',
        sections: [{ title: 'Exemples de recherches', bullets: ['Ouvrier d’usine', 'Agent de production', 'Manutentionnaire', 'Préparateur de commandes'] }],
        related: [{ label: 'Emploi logistique', href: '/emploi-logistique' }]
    },
    {
        path: '/emploi-logistique',
        title: 'Emploi logistique',
        description: 'Une page dédiée aux métiers de la logistique, de l’entrepôt, du magasinage et de la préparation de commandes.',
        h1: 'Emploi logistique',
        intro: 'JobHunter-AI peut aider à cibler des postes opérationnels dans la chaîne logistique et les entrepôts.',
        sections: [{ title: 'Métiers fréquents', bullets: ['Agent logistique', 'Magasinier', 'Préparateur de commandes', 'Agent d’entrepôt'] }]
    },
    {
        path: '/emploi-entrepot',
        title: 'Emploi entrepôt',
        description: 'Recherche d’emploi en entrepôt pour les métiers opérationnels et les postes liés à la préparation et à la gestion des flux.',
        h1: 'Emploi en entrepôt',
        intro: 'Une page dédiée aux recherches liées à l’entrepôt et aux métiers associés.',
        sections: [{ title: 'Cibles utiles', bullets: ['Magasinier', 'Préparateur de commandes', 'Manutentionnaire', 'Agent logistique'] }]
    },
    {
        path: '/emploi-saisonnier',
        title: 'Emploi saisonnier',
        description: 'Une page pour les recherches d’emploi saisonnier, utile pour les candidats qui veulent trouver rapidement des missions temporaires.',
        h1: 'Emploi saisonnier',
        intro: 'Les recherches saisonnières nécessitent des alertes rapides, des filtres efficaces et une bonne organisation des candidatures.',
        sections: [{ title: 'Atout principal', paragraphs: ['Le suivi automatisé permet de rester réactif lorsque les offres apparaissent.'] }]
    },
    {
        path: '/recherche-emploi-avec-ia',
        title: 'Recherche d’emploi avec IA',
        description: 'Découvrez comment l’intelligence artificielle peut accélérer la recherche d’emploi, l’analyse d’offres et la préparation de dossiers de candidature.',
        h1: 'Recherche d’emploi avec IA',
        intro: 'JobHunter-AI automatise les tâches répétitives tout en laissant la décision finale au candidat.',
        sections: [
            {
                title: 'Ce que l’IA apporte',
                bullets: [
                    'Analyse des annonces.',
                    'Mise en correspondance avec le profil.',
                    'Préparation de CV et de lettres.',
                    'Recherche planifiée et alertes.'
                ]
            }
        ],
        related: [
            { label: 'IA pour trouver un emploi', href: '/recherche-emploi-avec-ia' },
            { label: 'CV IA', href: '/cv-ia' },
            { label: 'Lettre de motivation IA', href: '/lettre-motivation-ia' }
        ]
    },
    {
        path: '/cv-ia',
        title: 'CV IA',
        description: 'Une page dédiée à la création et à l’optimisation de CV avec l’aide de l’intelligence artificielle.',
        h1: 'CV IA',
        intro: 'Préparez des variantes de CV adaptées à chaque candidature, sans perdre la cohérence de votre profil.',
        sections: [{ title: 'Utilité', bullets: ['Adapter le CV au poste.', 'Mettre en avant les bons mots-clés.', 'Réutiliser une base fiable.'] }]
    },
    {
        path: '/lettre-motivation-ia',
        title: 'Lettre de motivation IA',
        description: 'Préparer des lettres de motivation plus pertinentes avec un assistant IA, en gardant le contrôle sur le contenu final.',
        h1: 'Lettre de motivation IA',
        intro: 'L’IA aide à démarrer, reformuler et adapter vos lettres tout en restant fidèle à votre parcours.',
        sections: [{ title: 'Bonne pratique', paragraphs: ['Utiliser l’IA pour accélérer la rédaction, puis relire et personnaliser avant envoi.'] }]
    }
];

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[character]));
}

function absoluteUrl(baseUrl, routePath) {
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return `${normalizedBase}${normalizedPath === '/' ? '' : normalizedPath}`;
}

function structuredDataForPage(page, baseUrl) {
    const canonicalUrl = absoluteUrl(baseUrl, page.path);
    const common = {
        '@context': 'https://schema.org',
        url: canonicalUrl,
        name: page.title,
        description: page.description
    };

    if (page.path === '/' || ['en', 'de', 'it'].includes(page.locale)) {
        return [
            {
                ...common,
                '@type': 'WebPage'
            },
            {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: SITE_NAME,
                url: absoluteUrl(baseUrl, '/'),
                logo: absoluteUrl(baseUrl, '/favicon.svg')
            },
            {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: SITE_NAME,
                url: absoluteUrl(baseUrl, '/')
            },
            {
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: SITE_NAME,
                applicationCategory: 'BusinessApplication',
                operatingSystem: 'Web',
                url: absoluteUrl(baseUrl, '/app'),
                description: 'Plateforme web de recherche d’emploi assistée par IA.'
            }
        ];
    }

    return [
        {
            ...common,
            '@type': 'WebPage'
        }
    ];
}

function renderSections(page) {
    return page.sections.map((section) => {
        const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('') : '';
        const bullets = Array.isArray(section.bullets) ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : '';
        return `
            <section class="seo-section">
                <h2>${escapeHtml(section.title)}</h2>
                ${paragraphs}
                ${bullets}
            </section>
        `;
    }).join('');
}

function renderRelated(page) {
    if (!page.related?.length) return '';
    return `
        <section class="seo-section seo-related">
            <h2>Pages liées</h2>
            <div class="seo-links">
                ${page.related.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join('')}
            </div>
        </section>
    `;
}

function renderLocaleNav(baseUrl) {
    return `
        <div class="locale-switcher" aria-label="Langues">
            ${localeHomePages.map((page) => `<a href="${escapeHtml(page.path)}">${page.locale.toUpperCase()}</a>`).join('')}
            <a href="${escapeHtml(absoluteUrl(baseUrl, '/app'))}" class="locale-primary">Accéder à l’app</a>
        </div>
    `;
}

function renderPublicPage(page, baseUrl) {
    const canonicalUrl = absoluteUrl(baseUrl, page.path);
    const structuredData = structuredDataForPage(page, baseUrl);
    const alternates = page.alternates || [];
    const robots = page.noindex ? 'noindex, nofollow, noarchive' : 'index, follow';
    const isLocaleHome = page.path === '/' || ['en', 'de', 'it'].includes(page.locale);

    return `<!DOCTYPE html>
<html lang="${escapeHtml(page.locale || 'fr')}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="${robots}">
    <meta name="description" content="${escapeHtml(page.description)}">
    <meta name="theme-color" content="#0f172a">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
    <meta property="og:title" content="${escapeHtml(page.title)}">
    <meta property="og:description" content="${escapeHtml(page.description)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(page.title)}">
    <meta name="twitter:description" content="${escapeHtml(page.description)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
    ${alternates.map((alternate) => `<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(absoluteUrl(baseUrl, alternate.href))}">`).join('\n    ')}
    <link rel="stylesheet" href="/public.css">
    <title>${escapeHtml(page.title)}</title>
</head>
<body>
    <div class="seo-shell">
        <header class="seo-header">
            <a class="brand" href="/">
                <span class="brand-mark">J</span>
                <span>${escapeHtml(SITE_NAME)}</span>
            </a>
            ${renderLocaleNav(baseUrl)}
        </header>

        <main class="seo-main">
            <section class="hero">
                <p class="eyebrow">Recherche d’emploi assistée par IA</p>
                <h1>${escapeHtml(page.h1)}</h1>
                <p class="hero-copy">${escapeHtml(page.intro)}</p>
                <div class="hero-points">
                    ${(page.heroPoints || []).map((point) => `<span>${escapeHtml(point)}</span>`).join('')}
                </div>
                <div class="hero-actions">
                    <a class="button button-primary" href="/app">Ouvrir l’espace de travail</a>
                    <a class="button button-secondary" href="#contenu">Découvrir les pages</a>
                </div>
            </section>

            <section id="contenu" class="seo-section seo-intro">
                <h2>${isLocaleHome ? 'Comment JobHunter-AI vous aide' : 'Pourquoi cette page existe'}</h2>
                <p>${escapeHtml(page.description)}</p>
            </section>

            ${renderSections(page)}
            ${renderRelated(page)}
        </main>
    </div>

    <script type="application/ld+json">${JSON.stringify(structuredData, null, 2)}</script>
</body>
</html>`;
}

function getPublicPageByPath(pathname) {
    return [...localeHomePages, ...intentPages].find((page) => page.path === pathname);
}

function getPublicRoutes() {
    return [...localeHomePages, ...intentPages].map((page) => page.path);
}

function getSitemapEntries(baseUrl) {
    return [...localeHomePages, ...intentPages].map((page) => ({
        loc: absoluteUrl(baseUrl, page.path),
        changefreq: page.path === '/' || ['en', 'de', 'it'].includes(page.locale) ? 'weekly' : 'monthly',
        priority: page.path === '/' ? 1.0 : page.path.startsWith('/emploi') ? 0.8 : 0.7
    }));
}

export {
    getPublicPageByPath,
    getPublicRoutes,
    getSitemapEntries,
    renderPublicPage,
    absoluteUrl,
    localeHomePages,
    intentPages
};
