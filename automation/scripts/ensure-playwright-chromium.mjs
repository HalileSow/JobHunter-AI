import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

async function main() {
    const executablePath = chromium.executablePath();

    try {
        await access(executablePath);
        return;
    } catch {
        // Browser not installed yet: download Chromium for the current environment.
    }

    await new Promise((resolve, reject) => {
        const child = spawn('npx', ['playwright', 'install', 'chromium'], {
            stdio: 'inherit'
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) return resolve();
            reject(new Error(`playwright install chromium failed with exit code ${code}`));
        });
    });
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
