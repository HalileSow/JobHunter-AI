import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backupDatabase } from '../backup_db.js';

let tempDir;

before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'jobhunter-backup-test-'));
});

after(async () => {
    await rm(tempDir, { recursive: true, force: true });
});

test('sauvegarde la base de données et applique la règle de rétention', async () => {
    const fakeDbPath = path.join(tempDir, 'fake_jobhunter.db');
    const backupsDir = path.join(tempDir, 'backups');
    await writeFile(fakeDbPath, 'SQLITE DUMMY DATA CONTENT');

    // 1. Première sauvegarde
    const res1 = await backupDatabase({ dbPath: fakeDbPath, backupsDir, retentionMax: 2 });
    assert.equal(res1.success, true);
    assert.equal(res1.removedCount, 0);

    // 2. Deuxième sauvegarde
    const res2 = await backupDatabase({ dbPath: fakeDbPath, backupsDir, retentionMax: 2 });
    assert.equal(res2.success, true);

    // 3. Troisième sauvegarde - doit supprimer le plus ancien pour respecter retentionMax=2
    const res3 = await backupDatabase({ dbPath: fakeDbPath, backupsDir, retentionMax: 2 });
    assert.equal(res3.success, true);
    assert.equal(res3.removedCount, 1);

    const files = await readdir(backupsDir);
    assert.equal(files.length, 2);
});
