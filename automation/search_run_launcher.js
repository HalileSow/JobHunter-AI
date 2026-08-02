import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const automationScript = path.join(__dirname, 'main.js');

export async function launchSearchRun({
    runId,
    country,
    title,
    keywords = '',
    lang = 'fr',
    advancedFilters = {},
    selectedProviderIds = [],
    onStatusChange = null,
    cwd = __dirname
}) {
    if (!runId) {
        throw new Error('runId est obligatoire pour lancer une recherche.');
    }

    const db = await initDb();
    const payload = {
        ...advancedFilters,
        selectedProviderIds
    };

    const child = spawn(process.execPath, [automationScript, country, title, keywords || '', lang || 'fr', JSON.stringify(payload)], {
        cwd,
        stdio: 'ignore',
        detached: false
    });

    child.unref();

    const updateRun = async (updates) => {
        await db('search_runs').where({ id: runId }).update(updates);
        if (typeof onStatusChange === 'function') {
            onStatusChange(updates);
        }
    };

    child.once('spawn', () => {
        updateRun({ status: 'running', started_at: db.fn.now() }).catch(console.error);
    });

    child.once('error', (error) => {
        updateRun({ status: 'failed', error: error.message, finished_at: db.fn.now() }).catch(console.error);
    });

    child.once('close', (code) => {
        const status = code === 0 ? 'completed' : 'failed';
        const error = code === 0 ? null : `Code de sortie ${code}`;
        updateRun({ status, error, finished_at: db.fn.now() }).catch(console.error);
    });

    return child;
}
