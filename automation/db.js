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

const config = knexfile[environment];

const db = knex(config);

let initialized = false;

async function initDb() {
    if (!initialized) {
        if (config.client === 'sqlite3') {
            const filename = config.connection?.filename;
            if (typeof filename === 'string' && filename) {
                await fs.mkdir(path.dirname(filename), { recursive: true });
            }
        }

        // Enforce using absolute path for migrations so they run correctly
        // regardless of the current working directory (CWD) of the process.
        await db.migrate.latest({
            directory: path.resolve(__dirname, '../database/migrations')
        });
        initialized = true;
    }
    return db;
}

async function insertAndGetId(table, values) {
    const result = await db(table).insert(values).returning('id');
    const row = Array.isArray(result) ? result[0] : result;
    return row?.id ?? row;
}

export { db, initDb, insertAndGetId };
