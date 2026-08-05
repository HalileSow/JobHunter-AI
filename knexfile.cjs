require('dotenv/config');

const path = require('path');

function sqliteConfig() {
  return {
    client: 'sqlite3',
    connection: {
      filename: process.env.JOBHUNTER_DB_PATH || path.resolve(__dirname, 'database/jobhunter.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'database/migrations')
    }
  };
}

function postgresConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  return {
    client: 'pg',
    connection: {
      connectionString,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 0,
      max: 2,
      acquireTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'database/migrations'),
      tableName: 'knex_migrations',
      schemaName: 'public'
    }
  };
}

module.exports = {
  development: sqliteConfig(),
  test: sqliteConfig(),
  production: postgresConfig() || sqliteConfig(),
  postgres: postgresConfig()
};
