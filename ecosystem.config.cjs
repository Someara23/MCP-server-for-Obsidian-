module.exports = {
  apps: [
    {
      name: 'vault-api',
      script: 'src/index.js',
      watch: false,
      max_restarts: 10,
      restart_delay: 1000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
