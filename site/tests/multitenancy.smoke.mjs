import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';

const directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-multitenancy-'));
process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
process.env.JWT_SECRET = 'multitenancy-test-secret';
const { createApp } = await import('../server.mjs');
const { db } = await import('../../automation/db.js');
const server = createApp().listen(0, '127.0.0.1');

const request = (baseUrl, endpoint, token, options = {}) => fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
});

try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const register = async (email) => {
        const response = await request(baseUrl, '/api/auth/register', null, { method: 'POST', body: JSON.stringify({ email, password: 'password123' }) });
        assert.equal(response.status, 201);
        const login = await request(baseUrl, '/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email, password: 'password123' }) });
        return (await login.json()).token;
    };
    const tokenA = await register('a@example.com');
    const tokenB = await register('b@example.com');
    const profileA = await request(baseUrl, '/api/profile', tokenA, { method: 'PUT', body: JSON.stringify({ first_name: 'A' }) });
    assert.equal(profileA.status, 200);
    const profileB = await (await request(baseUrl, '/api/profile', tokenB)).json();
    assert.notEqual(profileB.first_name, 'A');
    const cvA = await (await request(baseUrl, '/api/cvs', tokenA, { method: 'POST', body: JSON.stringify({ name: 'A CV', content: '# A' }) })).json();
    const cvsB = await (await request(baseUrl, '/api/cvs', tokenB)).json();
    assert.equal(cvsB.some((cv) => cv.id === cvA.id), false);
    const foreignCv = await request(baseUrl, `/api/cvs/${cvA.id}/content`, tokenB);
    assert.equal(foreignCv.status, 404);
    const logout = await request(baseUrl, '/api/auth/logout', tokenA, { method: 'POST' });
    assert.equal(logout.status, 200);
    const relogin = await request(baseUrl, '/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: 'a@example.com', password: 'password123' }) });
    const tokenA2 = (await relogin.json()).token;
    const cvsA2 = await (await request(baseUrl, '/api/cvs', tokenA2)).json();
    assert.equal(cvsA2.some((cv) => cv.id === cvA.id), true);

    const longValue = 'mot-cle '.repeat(80);
    const scheduleAResponse = await request(baseUrl, '/api/schedules', tokenA2, {
        method: 'POST',
        body: JSON.stringify({
            name: `Recherche longue ${'x'.repeat(300)}`,
            country: 'France',
            title: `Développeur ${'backend '.repeat(40)}`,
            keywords: longValue,
            city: `Paris ${'centre '.repeat(50)}`,
            providers: ['indeed', 'linkedin']
        })
    });
    assert.equal(scheduleAResponse.status, 201);
    const scheduleA = await scheduleAResponse.json();
    assert.equal(scheduleA.user_id, 1);
    assert.equal(scheduleA.keywords, longValue);
    assert(scheduleA.name.length > 255);

    const scheduleBResponse = await request(baseUrl, '/api/schedules', tokenB, {
        method: 'POST',
        body: JSON.stringify({ name: 'Recherche B', country: 'France', title: 'QA' })
    });
    assert.equal(scheduleBResponse.status, 201);
    const scheduleB = await scheduleBResponse.json();
    const schedulesA = await (await request(baseUrl, '/api/schedules', tokenA2)).json();
    const schedulesB = await (await request(baseUrl, '/api/schedules', tokenB)).json();
    assert.equal(schedulesA.some((schedule) => schedule.id === scheduleA.id), true);
    assert.equal(schedulesA.some((schedule) => schedule.id === scheduleB.id), false);
    assert.equal(schedulesB.some((schedule) => schedule.id === scheduleA.id), false);
    assert.equal((await request(baseUrl, `/api/schedules/${scheduleA.id}/toggle`, tokenB, {
        method: 'PUT', body: JSON.stringify({ enabled: false })
    })).status, 404);
    assert.equal((await request(baseUrl, `/api/schedules/${scheduleA.id}`, tokenB, { method: 'DELETE' })).status, 404);

    const longSearchRun = await db('search_runs').insert({
        user_id: 1,
        country: `Pays ${'Europe '.repeat(60)}`,
        title: `Poste ${'spécialisé '.repeat(40)}`,
        keywords: `Compétence ${'avancée '.repeat(60)}`,
        lang: 'fr',
        status: 'queued'
    }).returning('id');
    const longSearchRunId = longSearchRun[0]?.id || longSearchRun[0];
    const storedLongSearchRun = await db('search_runs').where({ id: longSearchRunId, user_id: 1 }).first();
    assert(storedLongSearchRun.country.length > 255);
    assert(storedLongSearchRun.title.length > 255);
    assert(storedLongSearchRun.keywords.length > 255);

    const adminId = await db('users').insert({ email: 'admin@test.local', password: await bcrypt.hash('password123', 12), role: 'SUPER_ADMIN', status: 'ACTIVE' });
    assert(adminId);
    const adminLogin = await request(baseUrl, '/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: 'ADMIN@TEST.LOCAL', password: 'password123' }) });
    const adminToken = (await adminLogin.json()).token;
    assert.equal((await request(baseUrl, '/api/admin/users', adminToken)).status, 200);
    assert.equal((await request(baseUrl, '/api/admin/users', tokenA2)).status, 403);
    console.log('✔ isolation A/B, persistance CV, RBAC et recherches planifiées longues validés');
} finally {
    await db.destroy();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
}
