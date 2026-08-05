import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowser, releaseBrowser, createBrowserContext } from './browser_pool.js';
import { exportCvToPdf } from './cv_exporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sanitizeName(value = '') {
    return String(value).replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'document';
}

function pickProfileValue(profile, keys) {
    for (const key of keys) {
        const value = profile?.[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function normalizeProfile(profile = {}) {
    const parseList = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : value.split(',').map((item) => item.trim()).filter(Boolean);
            } catch {
                return value.split(',').map((item) => item.trim()).filter(Boolean);
            }
        }
        return [];
    };

    return {
        first_name: pickProfileValue(profile, ['first_name', 'firstName']),
        last_name: pickProfileValue(profile, ['last_name', 'lastName']),
        email: pickProfileValue(profile, ['email']),
        phone: pickProfileValue(profile, ['phone']),
        address: pickProfileValue(profile, ['address']),
        nationality: pickProfileValue(profile, ['nationality']),
        availability: pickProfileValue(profile, ['availability']),
        skills: parseList(profile.skills),
        languages: parseList(profile.languages),
        experience: pickProfileValue(profile, ['experience']),
        education: pickProfileValue(profile, ['education'])
    };
}

async function readCvContent(cvPath) {
    try {
        return await fs.readFile(cvPath, 'utf-8');
    } catch {
        return '';
    }
}

export async function buildApplicationDocuments({ job, profile, selectedCvPath, letterText, letterPath, lang = 'fr', outputDir = null }) {
    const safeCompany = sanitizeName(job?.company || 'company');
    const safeTitle = sanitizeName(job?.title || 'job');
    const timestamp = Date.now();
    const targetDir = outputDir ? path.resolve(outputDir) : path.resolve(__dirname, '../cover_letters/generated/applications');
    await fs.mkdir(targetDir, { recursive: true });

    const cvContent = await readCvContent(selectedCvPath);
    const tailoredCvPath = path.join(targetDir, `${safeCompany}_${safeTitle}_${timestamp}_${lang}_cv.pdf`);

    await exportCvToPdf(
        cvContent || 'CV indisponible.',
        job?.title || 'Poste ciblé',
        job?.company || 'Entreprise',
        tailoredCvPath,
        [
            job?.title ? `Poste ciblé: ${job.title}` : '',
            job?.company ? `Entreprise: ${job.company}` : '',
            job?.location ? `Localisation: ${job.location}` : ''
        ].filter(Boolean)
    );

    return {
        tailoredCvPath,
        letterPath: letterPath || null,
        letterText: letterText || '',
        selectedCvPath,
        cvContent,
        profile: normalizeProfile(profile)
    };
}

async function clickFirstVisible(locator) {
    const count = await locator.count();
    for (let i = 0; i < count; i += 1) {
        const element = locator.nth(i);
        try {
            if (await element.isVisible()) {
                await element.click({ timeout: 2000 });
                return true;
            }
        } catch {
            // Ignore hidden/unusable element
        }
    }
    return false;
}

async function clickApplyTrigger(page) {
    const candidates = [
        page.getByRole('button', { name: /postuler|apply now|apply|envoyer|soumettre|candidature|easy apply/i }),
        page.getByRole('link', { name: /postuler|apply now|apply|envoyer|soumettre|candidature|easy apply/i }),
        page.locator('button[data-testid*="apply" i], a[data-testid*="apply" i]'),
        page.locator('button, a, input[type="button"], input[type="submit"]')
    ];

    for (const candidate of candidates) {
        if (await clickFirstVisible(candidate)) {
            return true;
        }
    }
    return false;
}

async function fillBySelectors(page, selectors, value) {
    if (!value) return false;
    for (const selector of selectors) {
        const locator = page.locator(selector).first();
        try {
            if (await locator.count() && await locator.isVisible()) {
                await locator.fill(value, { timeout: 2000 });
                return true;
            }
        } catch {
            // Try next selector
        }
    }
    return false;
}

async function fillByLabel(page, labels, value) {
    if (!value) return false;
    for (const label of labels) {
        try {
            const locator = page.getByLabel(label, { exact: false }).first();
            if (await locator.count() && await locator.isVisible()) {
                await locator.fill(value, { timeout: 2000 });
                return true;
            }
        } catch {
            // Try next label
        }
    }
    return false;
}

async function fillCommonFields(page, profile, letterText) {
    const fieldMap = [
        {
            value: profile.first_name,
            labels: [/prénom/i, /first name/i, /given name/i],
            selectors: ['input[autocomplete="given-name"]', 'input[name*="first" i]', 'input[id*="first" i]']
        },
        {
            value: profile.last_name,
            labels: [/nom/i, /last name/i, /family name/i],
            selectors: ['input[autocomplete="family-name"]', 'input[name*="last" i]', 'input[id*="last" i]']
        },
        {
            value: profile.email,
            labels: [/e-?mail/i, /email/i, /courriel/i],
            selectors: ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]']
        },
        {
            value: profile.phone,
            labels: [/t[ée]l[ée]phone/i, /phone/i, /mobile/i],
            selectors: ['input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]']
        },
        {
            value: profile.address,
            labels: [/adresse/i, /address/i],
            selectors: ['input[name*="address" i]', 'textarea[name*="address" i]', 'input[id*="address" i]']
        },
        {
            value: profile.nationality,
            labels: [/nationalit[ée]/i, /nationality/i],
            selectors: ['input[name*="national" i]', 'input[id*="national" i]']
        },
        {
            value: letterText,
            labels: [/lettre/i, /cover letter/i, /motivation/i, /message/i],
            selectors: ['textarea[name*="letter" i]', 'textarea[name*="cover" i]', 'textarea[id*="letter" i]', 'textarea[id*="cover" i]']
        }
    ];

    for (const field of fieldMap) {
        await fillByLabel(page, field.labels, field.value);
        await fillBySelectors(page, field.selectors, field.value);
    }

    return true;
}

async function attachFileToInputs(page, filesByHint) {
    const fileInputs = page.locator('input[type="file"]');
    const count = await fileInputs.count();
    if (count === 0) return [];

    const attached = [];
    const descriptors = await fileInputs.evaluateAll((inputs) => inputs.map((el, index) => {
        const label = el.id ? document.querySelector(`label[for="${el.id}"]`)?.innerText || '' : '';
        return {
            index,
            name: el.name || '',
            id: el.id || '',
            accept: el.accept || '',
            label
        };
    }));

    const candidates = {
        cv: filesByHint.cvPath,
        letter: filesByHint.letterPath
    };

    for (const [kind, filePath] of Object.entries(candidates)) {
        if (!filePath) continue;
        const descriptor = descriptors.find((item) => {
            const haystack = `${item.name} ${item.id} ${item.accept} ${item.label}`.toLowerCase();
            if (kind === 'cv') {
                return /(cv|resume|curriculum|curriculum vitae|document)/i.test(haystack);
            }
            return /(lettre|letter|cover|motivation|message)/i.test(haystack);
        });

        try {
            if (descriptor) {
                await fileInputs.nth(descriptor.index).setInputFiles(filePath);
                attached.push({ kind, index: descriptor.index, filePath });
            } else if (kind === 'cv' && count > 0) {
                await fileInputs.first().setInputFiles(filePath);
                attached.push({ kind, index: 0, filePath });
            } else if (kind === 'letter' && count > 1) {
                await fileInputs.nth(1).setInputFiles(filePath);
                attached.push({ kind, index: 1, filePath });
            }
        } catch {
            // Continue with other hints
        }
    }

    return attached;
}

function detectConfirmationId(text = '') {
    const match = text.match(/(?:confirmation|reference|réf(?:érence)?|id)[^A-Z0-9]{0,12}([A-Z0-9-]{4,})/i);
    return match ? match[1] : '';
}

export async function automateApplication({ job, profile, tailoredCvPath, letterText, letterPath, providerName = 'generic', timeoutMs = 30000 }) {
    let lock = null;
    let context = null;
    let page = null;

    let result = {
        success: false,
        needsConfirmation: false,
        status: 'échouée',
        mode: 'auto',
        details: '',
        error: '',
        confirmationId: '',
        applicationUrl: job?.link || ''
    };

    try {
        // OPTIMISATION MÉMOIRE : Utiliser le pool de browsers au lieu de lancer une nouvelle instance
        const browserResult = await getBrowser();
        const browser = browserResult.browser;
        lock = browserResult.lock;
        
        context = await createBrowserContext(browser);
        page = await context.newPage({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        });
        await page.goto(job.link, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await page.waitForTimeout(500);

        const started = await clickApplyTrigger(page);
        if (!started) {
            result = {
                ...result,
                needsConfirmation: true,
                status: 'en attente',
                details: 'Aucun déclencheur de candidature détecté sur la page.',
                error: 'NO_APPLY_TRIGGER'
            };
            return result;
        }

        await page.waitForTimeout(500);

        const hasForm = await page.locator('form, input[type="file"], textarea, input[type="email"], input[type="text"]').count();
        if (!hasForm) {
            result = {
                ...result,
                needsConfirmation: true,
                status: 'en attente',
                details: 'Aucun formulaire de candidature détecté après ouverture.',
                error: 'NO_FORM'
            };
            return result;
        }

        await fillCommonFields(page, profile, letterText);
        await attachFileToInputs(page, { cvPath: tailoredCvPath, letterPath });

        const submitClicked = await clickFirstVisible(
            page.getByRole('button', { name: /postuler|apply|submit|envoyer|soumettre|valider/i })
                .or(page.getByRole('link', { name: /postuler|apply|submit|envoyer|soumettre|valider/i }))
                .or(page.locator('input[type="submit"], button[type="submit"]'))
        );

        if (!submitClicked) {
            result = {
                ...result,
                needsConfirmation: true,
                status: 'en attente',
                details: 'Le formulaire a été rempli mais aucun bouton de soumission n’a été trouvé.',
                error: 'NO_SUBMIT_BUTTON'
            };
            return result;
        }

        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(1200);

        const bodyText = await page.locator('body').innerText().catch(() => '');
        const url = page.url();
        const successSignals = [
            /merci/i,
            /thank you/i,
            /submission received/i,
            /application received/i,
            /candidature (?:reçue|envoyée|soumise)/i,
            /confirmed/i,
            /success/i
        ];
        const succeeded = successSignals.some((pattern) => pattern.test(bodyText)) || /confirmation|thanks|success|submitted/i.test(url);

        if (!succeeded) {
            result = {
                ...result,
                needsConfirmation: true,
                status: 'en attente',
                details: 'Aucun signal de confirmation clair détecté après soumission.',
                error: 'NO_SUCCESS_SIGNAL',
                applicationUrl: url
            };
            return result;
        }

        result = {
            success: true,
            needsConfirmation: false,
            status: 'réussie',
            mode: 'auto',
            details: `Candidature soumise via ${providerName}.`,
            error: '',
            confirmationId: detectConfirmationId(bodyText),
            applicationUrl: url
        };
        return result;
    } catch (error) {
        const message = error?.message || 'Erreur inconnue';
        const needsConfirmation = /no form|no submit|timeout|not found|detached|element/i.test(message.toLowerCase());
        result = {
            ...result,
            success: false,
            needsConfirmation,
            status: needsConfirmation ? 'en attente' : 'échouée',
            error: message,
            details: `Échec d’automatisation pour ${providerName}: ${message}`
        };
        return result;
    } finally {
        // OPTIMISATION MÉMOIRE : Fermer le context et libérer le lock, pas le browser
        if (page) await page.close().catch(() => undefined);
        if (context) await context.close().catch(() => undefined);
        if (lock) releaseBrowser(lock);
    }
}
