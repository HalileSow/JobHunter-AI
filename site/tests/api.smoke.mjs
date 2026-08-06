import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-api-'));
process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
process.env.JWT_SECRET = 'test-secret';

// Dynamically import createApp after setting environment variables so the database uses the test path
const { createApp } = await import('../server.mjs');
const server = createApp().listen(0, '127.0.0.1');

try {
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    // === Test 1: Register and login as regular user ===
    const userPayload = { email: 'test@example.com', password: 'password123' };
    const reg = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(userPayload) });
    assert.equal(reg.status, 201);
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(userPayload) });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert(token);
    const headers = { 'content-type': 'application/json', 'authorization': `Bearer ${token}` };

    // === Test 2: Profile ===
    const payload = { first_name: 'Ibrahima', last_name: 'Sow', email: 'ibrahima@example.test', skills: ['Vente', 'Excel'], availability: 'Immédiatement' };
    const save = await fetch(`${baseUrl}/api/profile`, { method: 'PUT', headers, body: JSON.stringify(payload) });
    assert.equal(save.status, 200);
    const read = await fetch(`${baseUrl}/api/profile`, { headers: { 'authorization': `Bearer ${token}` } });
    assert.equal(read.status, 200);
    const profile = await read.json();
    assert.equal(profile.first_name, 'Ibrahima');

    // === Test 3: System status (public route) ===
    const statusRes = await fetch(`${baseUrl}/api/system/status`);
    assert.equal(statusRes.status, 200);
    const systemStatus = await statusRes.json();
    assert.equal(systemStatus.status, 'healthy');
    assert(typeof systemStatus.activeProviders === 'number');

    // === Test 4: Admin backup — requires SUPER_ADMIN role ===
    // Promote the test user to SUPER_ADMIN directly in the DB
    const { db } = await import('../../automation/db.js');
    await db('users').where({ email: 'test@example.com' }).update({ role: 'SUPER_ADMIN' });

    // Re-login to get a fresh token with SUPER_ADMIN role
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(userPayload) });
    assert.equal(adminLogin.status, 200);
    const { token: adminToken } = await adminLogin.json();
    const adminHeaders = { 'content-type': 'application/json', 'authorization': `Bearer ${adminToken}` };

    const backupRes = await fetch(`${baseUrl}/api/admin/backup`, { method: 'POST', headers: adminHeaders });
    assert.equal(backupRes.status, 200);
    const backupData = await backupRes.json();
    assert.equal(backupData.success, true);
    assert(backupData.backupFileName);

    // === Test 5: Admin users list ===
    const usersRes = await fetch(`${baseUrl}/api/admin/users`, { headers: adminHeaders });
    assert.equal(usersRes.status, 200);
    const users = await usersRes.json();
    assert(Array.isArray(users));
    assert(users.length >= 1);

    console.log('✔ API profil, system/status, backup et admin/users : tous les tests validés');
} finally {
    const { db } = await import('../../automation/db.js');
    await db.destroy();
    await new Promise((resolve) => server.close(resolve));
    delete process.env.JOBHUNTER_DB_PATH;
    delete process.env.JWT_SECRET;
    await rm(directory, { recursive: true, force: true });
}
