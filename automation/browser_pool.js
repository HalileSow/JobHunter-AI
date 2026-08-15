import { chromium } from 'playwright';

/**
 * Pool singleton de browsers Playwright pour éviter de lancer
 * plusieurs instances Chromium simultanément.
 * 
 * Sur Render Starter (512 Mo RAM), une seule instance Chromium
 * peut consommer 150-300 Mo. Lancer plusieurs instances en parallèle
 * provoque un OOM kill.
 */

let browserInstance = null;
let browserLock = null;
let browserLockTime = 0;
const BROWSER_LOCK_TIMEOUT = 60000; // 60s max pour une opération

/**
 * Arguments Chromium optimisés pour minimiser la consommation mémoire.
 */
const CHROMIUM_ARGS = [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--disable-accelerated-2d-canvas',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-extensions',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
    '--disable-ipc-flooding-protection',
    '--disable-sync',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process'
];

/**
 * Acquiert le lock du browser. Si un autre utilisateur détient le lock,
 * attend jusqu'à ce qu'il soit libéré ou timeout.
 */
async function acquireBrowserLock() {
    const startTime = Date.now();
    
    while (browserLock !== null) {
        // Vérifier si le lock est expiré (protection contre les locks orphelins)
        if (Date.now() - browserLockTime > BROWSER_LOCK_TIMEOUT) {
            console.warn('⚠️ [BrowserPool] Lock expiré, réinitialisation forcée');
            browserLock = null;
            break;
        }
        
        // Attendre 500ms avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Timeout global de 90s pour éviter l'attente infinie
        if (Date.now() - startTime > 90000) {
            throw new Error('Timeout: impossible d\'acquérir le lock du browser après 90s');
        }
    }
    
    browserLock = Symbol('browser-lock');
    browserLockTime = Date.now();
    return browserLock;
}

/**
 * Libère le lock du browser.
 */
function releaseBrowserLock(lock) {
    if (browserLock === lock) {
        browserLock = null;
        browserLockTime = 0;
    }
}

/**
 * Récupère ou crée l'instance browser singleton.
 * Retourne aussi un lock qui doit être libéré après usage.
 * Inclut un retry mechanism pour gérer les crashes inattendus.
 */
export async function getBrowser() {
    const lock = await acquireBrowserLock();

    try {
        // Vérifier et recréer le browser si nécessaire
        if (!browserInstance || !browserInstance.isConnected()) {
            console.log('🚀 [BrowserPool] Lancement de Chromium...');
            
            // Nettoyer l'ancienne instance si elle existe
            if (browserInstance) {
                try {
                    await browserInstance.close().catch(() => {});
                } catch (e) {
                    // Ignore les erreurs de fermeture
                }
                browserInstance = null;
            }
            
            browserInstance = await chromium.launch({
                headless: true,
                args: CHROMIUM_ARGS
            });

            // Gestionnaire de fermeture inattendue
            browserInstance.on('disconnected', () => {
                console.log('🔌 [BrowserPool] Browser déconnecté');
                browserInstance = null;
            });
        }

        // Vérification finale avant de retourner
        if (!browserInstance || !browserInstance.isConnected()) {
            releaseBrowserLock(lock);
            throw new Error('Browser failed to start or connect');
        }

        return { browser: browserInstance, lock };
    } catch (error) {
        releaseBrowserLock(lock);
        throw error;
    }
}

/**
 * Libère le lock après usage. Ne ferme PAS le browser (il est réutilisé).
 */
export function releaseBrowser(lock) {
    releaseBrowserLock(lock);
}

/**
 * Ferme complètement le browser (pour cleanup final).
 */
export async function closeBrowser() {
    if (browserInstance) {
        try {
            await browserInstance.close();
            console.log('✅ [BrowserPool] Browser fermé');
        } catch (error) {
            console.error('❌ [BrowserPool] Erreur fermeture browser:', error.message);
        }
        browserInstance = null;
    }
    browserLock = null;
    browserLockTime = 0;
}

/**
 * Crée un nouveau context avec des options optimisées mémoire.
 * Vérifie que le browser est toujours connecté avant de créer le context.
 */
export async function createBrowserContext(browser) {
    // Vérifier que le browser est toujours connecté
    if (!browser || !browser.isConnected()) {
        throw new Error('Browser is not connected. Cannot create context.');
    }
    
    return await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        bypassCSP: false,
        javaScriptEnabled: true,
        storageState: undefined
    });
}

/**
 * Crée une page avec retry automatique en cas de crash du browser.
 * Si le browser crash entre la création du context et newPage(),
 * cette fonction réessaie une fois après avoir recréé le browser.
 */
export async function createPageWithRetry(browser, lock, maxRetries = 1) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let context = null;
        try {
            context = await createBrowserContext(browser);
            const page = await context.newPage();
            // Le retry peut avoir réacquis un lock différent. Le retourner est
            // indispensable pour que l'appelant libère le bon lock dans son
            // bloc finally.
            return { context, page, lock };
        } catch (error) {
            // Si le browser a crashé, essayer de le recréer
            if (attempt < maxRetries && /closed|disconnected|target/i.test(error.message)) {
                console.warn(`⚠️ [BrowserPool] Browser crashé lors de newPage(), tentative de recréation (${attempt + 1}/${maxRetries})...`);

                // Fermer le context s'il a été créé
                if (context) await context.close().catch(() => {});

                // Libérer et réacquérir le lock pour recréer le browser
                releaseBrowserLock(lock);
                const newResult = await getBrowser();
                browser = newResult.browser;
                lock = newResult.lock;
            } else {
                // Fermer le context en cas d'erreur finale
                if (context) await context.close().catch(() => {});
                throw error;
            }
        }
    }
}

// Ensure Chromium is cleaned up if the process exits unexpectedly
function setupExitHandler() {
    if (browser_pool_exit_handler_installed) return;
    browser_pool_exit_handler_installed = true;
    const cleanup = async () => { await closeBrowser(); };
    process.on('exit', cleanup);
    process.on('SIGTERM', () => { closeBrowser().catch(() => {}); });
    process.on('SIGINT', () => { closeBrowser().catch(() => {}); });
}
let browser_pool_exit_handler_installed = false;
setupExitHandler();
