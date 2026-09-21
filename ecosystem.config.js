module.exports = {
  apps: [
    {
      name: 'nanohub-server',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production',
        PORT: 3333,
        ESP32_URL: 'http://homehub.local', // Change to physical ESP32 IP if needed (e.g. http://192.168.1.150)
        SYNC_INTERVAL_MS: 2500,
        CORS_ORIGIN: '*',
      },
    },
  ],
};
