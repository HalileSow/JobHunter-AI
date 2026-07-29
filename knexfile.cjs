require('dotenv/config');

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.JOBHUNTER_DB_PATH || require('path').resolve(__dirname, 'database/jobhunter.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: require('path').resolve(__dirname, 'database/migrations')
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
