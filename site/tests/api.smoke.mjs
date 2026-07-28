import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';

const directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-api-'));
process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
process.env.JWT_SECRET = 'test-secret';
const server = createApp().listen(0, '127.0.0.1');

try {
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Register and login
    const userPayload = { email: 'test@example.com', password: 'password123' };
    const reg = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(userPayload) });
    assert.equal(reg.status, 201);
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(userPayload) });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert(token);
    const headers = { 'content-type': 'application/json', 'authorization': `Bearer ${token}` };

    const payload = { first_name: 'Ibrahima', last_name: 'Sow', email: 'ibrahima@example.test', skills: ['Vente', 'Excel'], availability: 'Immédiatement' };
    const save = await fetch(`${baseUrl}/api/profile`, { method: 'PUT', headers, body: JSON.stringify(payload) });
    assert.equal(save.status, 200);
    const read = await fetch(`${baseUrl}/api/profile`, { headers: { 'authorization': `Bearer ${token}` } });
    assert.equal(read.status, 200);
    const profile = await read.json();
    assert.equal(profile.first_name, 'Ibrahima');
    assert.deepEqual(JSON.parse(profile.skills), ['Vente', 'Excel']);
    console.log('✔ API profil : enregistrement et lecture validés');
} finally {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.JOBHUNTER_DB_PATH;
    delete process.env.JWT_SECRET;
    await rm(directory, { recursive: true, force: true });
}
