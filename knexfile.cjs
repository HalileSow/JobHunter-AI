require('dotenv/config');

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.JOBHUNTER_DB_PATH || './database/jobhunter.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './database/migrations'
    }
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './database/migrations'
    }
  }
};
