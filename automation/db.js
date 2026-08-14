import knex from 'knex';
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import knexfile from '../knexfile.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.env.NODE_ENV || 'development';
if (environment === 'production' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL est obligatoire en production. SQLite est interdit en production.');
}

let dbInstance = null;
let currentDbPath = null;

async function initDb() {
    const config = knexfile[environment];
    const newDbPath = config.connection?.filename;

    // Si on a déjà une instance et que le chemin n'a pas changé, on réutilise
    if (dbInstance && newDbPath === currentDbPath) {
        return dbInstance;
    }

    // Sinon, on détruit l'ancienne instance si elle existe
    if (dbInstance) {
        await dbInstance.destroy();
    }

    if (config.client === 'sqlite3' && newDbPath) {
        await fs.mkdir(path.dirname(newDbPath), { recursive: true });
    }

    dbInstance = knex(config);
    currentDbPath = newDbPath;

    // Migrations
    await dbInstance.migrate.latest({
        directory: path.resolve(__dirname, '../database/migrations')
    });
    
    return dbInstance;
}

async function insertAndGetId(table, values) {
    const db = await initDb();
    const result = await db(table).insert(values).returning('id');
    const row = Array.isArray(result) ? result[0] : result;
    return row?.id ?? row;
}

async function destroyDb() {
    if (!dbInstance) return;
    const instance = dbInstance;
    dbInstance = null;
    currentDbPath = null;
    await instance.destroy();
}

// Pour garantir que les tests ne partagent pas d'instance, on exporte une fonction.
// On garde dbInstance pour le module, mais on force initDb à gérer la recréation.
export { initDb, insertAndGetId, destroyDb };
