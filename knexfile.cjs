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

module.exports = {
  development: sqliteConfig(),
  production: process.env.DATABASE_URL
    ? {
        client: 'pg',
        connection: process.env.DATABASE_URL,
        migrations: {
          directory: './database/migrations'
        }
      }
    : sqliteConfig()
};
