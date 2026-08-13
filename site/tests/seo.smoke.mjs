import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-seo-'));
process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
process.env.JWT_SECRET = 'test-secret';

const { createApp } = await import('../server.mjs');
const server = createApp().listen(0, '127.0.0.1');

try {
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert(homeHtml.includes('JobHunter-AI'));
    assert(homeHtml.includes('Recherche d’emploi intelligente'));
    assert(homeHtml.includes('canonical'));
    assert(homeHtml.includes('application/ld+json'));

    const appRes = await fetch(`${baseUrl}/app`);
    assert.equal(appRes.status, 200);
    assert.equal(appRes.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

    const robots = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robots.status, 200);
    const robotsTxt = await robots.text();
    assert(robotsTxt.includes('Disallow: /api/'));
    assert(robotsTxt.includes('Sitemap:'));

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemap.status, 200);
    const sitemapXml = await sitemap.text();
    assert(sitemapXml.includes('/emploi'));
    assert(sitemapXml.includes('/en'));
    assert(sitemapXml.includes('/recherche-emploi-avec-ia'));

    const publicPage = await fetch(`${baseUrl}/emploi-sans-diplome`);
    assert.equal(publicPage.status, 200);
    const publicPageHtml = await publicPage.text();
    assert(publicPageHtml.includes('Emploi sans diplôme'));
    assert(publicPageHtml.includes('meta name="robots" content="index, follow"'));

    const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifest.status, 200);
    const manifestJson = await manifest.json();
    assert.equal(manifestJson.start_url, '/app');

    console.log('✔ SEO public, robots, sitemap et noindex de /app : tous les tests validés');
} finally {
    const { initDb } = await import('../../automation/db.js');
    const db = await initDb();
    await db.destroy();
    await new Promise((resolve) => server.close(resolve));
    delete process.env.JOBHUNTER_DB_PATH;
    delete process.env.JWT_SECRET;
    await rm(directory, { recursive: true, force: true });
}
