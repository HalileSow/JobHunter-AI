import knex from 'knex';
import path from 'path';
import { fileURLToPath } from 'url';
import knexfile from '../knexfile.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.env.NODE_ENV || 'development';
const config = knexfile[environment];

const db = knex(config);

let initialized = false;

async function initDb() {
    if (!initialized) {
        // Enforce using absolute path for migrations so they run correctly
        // regardless of the current working directory (CWD) of the process.
        await db.migrate.latest({
            directory: path.resolve(__dirname, '../database/migrations')
        });
        initialized = true;
    }
    return db;
}

export { db, initDb };
