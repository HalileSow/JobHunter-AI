import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';

const directory = await mkdtemp(path.join(tmpdir(), 'jobhunter-api-'));
process.env.JOBHUNTER_DB_PATH = path.join(directory, 'jobhunter.db');
const server = createApp().listen(0, '127.0.0.1');

try {
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const payload = { first_name: 'Ibrahima', last_name: 'Sow', email: 'ibrahima@example.test', skills: ['Vente', 'Excel'], availability: 'Immédiatement' };
    const save = await fetch(`${baseUrl}/api/profile`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(save.status, 200);
    const read = await fetch(`${baseUrl}/api/profile`);
    assert.equal(read.status, 200);
    const profile = await read.json();
    assert.equal(profile.first_name, 'Ibrahima');
    assert.deepEqual(JSON.parse(profile.skills), ['Vente', 'Excel']);
    console.log('✔ API profil : enregistrement et lecture validés');
} finally {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.JOBHUNTER_DB_PATH;
    await rm(directory, { recursive: true, force: true });
}
