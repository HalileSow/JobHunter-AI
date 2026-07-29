module.exports = {
  apps: [
    {
      name: 'jobhunter-ai',
      script: 'site/server.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4173
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 4173
      }
    }
  ]
};
