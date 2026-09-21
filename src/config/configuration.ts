export interface AppConfig {
  port: number;
  esp32Url: string;
  syncIntervalMs: number;
  corsOrigin: string;
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env.PORT, 10) || 8080,
    esp32Url: (process.env.ESP32_URL || process.env.ESP32_HOST || 'http://homehub.local').trim().replace(/\/+$/, ''),
    syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS, 10) || 2500,
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
});
