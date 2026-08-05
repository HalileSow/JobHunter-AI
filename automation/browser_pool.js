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
 */
export async function getBrowser() {
    const lock = await acquireBrowserLock();
    
    try {
        if (!browserInstance || !browserInstance.isConnected()) {
            console.log('🚀 [BrowserPool] Lancement de Chromium...');
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
 */
export async function createBrowserContext(browser) {
    return await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        // Désactiver les images pour réduire la mémoire
        bypassCSP: false,
        javaScriptEnabled: true,
        // Limiter le stockage
        storageState: undefined
    });
}
