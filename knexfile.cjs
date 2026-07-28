require('dotenv/config');

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './database/jobhunter.db'
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
