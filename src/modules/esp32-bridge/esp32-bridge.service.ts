import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from '../events/events.gateway';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface BridgeState {
  mains: boolean;
  temp: number;
  hum: number;
  uptime_sec: number;
  wifi_rssi: number;
  outages: number;
  last_ir: string;
  configured: boolean;
  bridge_mode: string;
  esp32_url: string;
  esp32_online: boolean;
  last_sync: string | null;
  sync_errors: number;
}

@Injectable()
export class Esp32BridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Esp32BridgeService.name);
  private esp32Url: string;
  private readonly syncIntervalMs: number;
  private syncTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly serverStartTime = Date.now();

  private state: BridgeState = {
    mains: true,
    temp: 24.5,
    hum: 55.0,
    uptime_sec: 0,
    wifi_rssi: -55,
    outages: 0,
    last_ir: 'None',
    configured: true,
    bridge_mode: 'LIVE_BRIDGE',
    esp32_url: '',
    esp32_online: false,
    last_sync: null,
    sync_errors: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly eventsGateway: EventsGateway,
  ) {
    this.esp32Url = this.configService.get<string>('app.esp32Url', 'http://homehub.local');
    this.syncIntervalMs = this.configService.get<number>('app.syncIntervalMs', 2500);
    this.state.esp32_url = this.esp32Url;
  }

  onModuleInit() {
    this.logger.log(`Initialized ESP32 Bridge Service. Target: ${this.esp32Url}`);
    // Start background sync
    this.syncTimer = setInterval(() => this.syncHardware(), this.syncIntervalMs);
    // Initial immediate sync
    this.syncHardware();

    // Start 15s status broadcast
    this.heartbeatTimer = setInterval(() => this.broadcastHeartbeat(), 15000);
  }

  onModuleDestroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  getState(): BridgeState {
    return { ...this.state };
  }

  async setTargetUrl(url: string): Promise<BridgeState> {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    this.esp32Url = cleanUrl.replace(/\/+$/, '');
    this.state.esp32_url = this.esp32Url;
    this.logger.log(`Target ESP32 URL updated to: ${this.esp32Url}`);
    this.eventsGateway.broadcast(`[BRIDGE] Target URL updated to ${this.esp32Url}. Testing connection...`);
    
    await this.syncHardware();
    return this.getState();
  }

  updateStatePartial(partial: Partial<BridgeState>) {
    Object.assign(this.state, partial);
  }

  async syncHardware(): Promise<void> {
    if (!this.esp32Url) return;

    try {
      const res = await this.rawRequest('/api/status', { timeout: 2500 });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const data = JSON.parse(res.body);

        const previousMains = this.state.mains;
        this.state.mains = Boolean(data.mains);
        this.state.temp = typeof data.temp === 'number' ? data.temp : (typeof data.temperature === 'number' ? data.temperature : this.state.temp);
        this.state.hum = typeof data.hum === 'number' ? data.hum : (typeof data.humidity === 'number' ? data.humidity : this.state.hum);
        this.state.wifi_rssi = typeof data.wifi_rssi === 'number' ? data.wifi_rssi : (typeof data.rssi === 'number' ? data.rssi : this.state.wifi_rssi);
        this.state.uptime_sec = typeof data.uptime_sec === 'number' ? data.uptime_sec : (typeof data.uptime === 'number' ? data.uptime : this.state.uptime_sec);
        this.state.outages = typeof data.outages === 'number' ? data.outages : this.state.outages;

        if (data.last_ir && data.last_ir !== 'None') {
          this.state.last_ir = data.last_ir;
        }
        if (typeof data.configured === 'boolean') {
          this.state.configured = data.configured;
        }

        // Outage transition detection
        if (previousMains !== this.state.mains) {
          if (!this.state.mains) {
            this.state.outages++;
            const msg = `[GRID ALERT] *** MAINS OUTAGE DETECTED on ESP32! (Cut #${this.state.outages}) ***`;
            this.logger.warn(msg);
            this.eventsGateway.broadcast(msg);
          } else {
            const msg = `[GRID ALERT] *** MAINS POWER RESTORED on ESP32 (5V Active) ***`;
            this.logger.log(msg);
            this.eventsGateway.broadcast(msg);
          }
        }

        if (!this.state.esp32_online) {
          this.logger.log(`Linked to physical ESP32 at: ${this.esp32Url}`);
          this.eventsGateway.broadcast(`[BRIDGE] Linked to physical ESP32 at: ${this.esp32Url}`);
        }

        this.state.esp32_online = true;
        this.state.bridge_mode = 'LIVE_BRIDGE';
        this.state.last_sync = new Date().toISOString();
        this.state.sync_errors = 0;
      } else {
        throw new Error(`ESP32 returned HTTP ${res.statusCode}`);
      }
    } catch (err) {
      this.state.sync_errors++;
      if (this.state.esp32_online) {
        this.logger.warn(`Lost connection with ESP32 at ${this.esp32Url}: ${err.message}. Serving cached telemetry.`);
        this.eventsGateway.broadcast(`[BRIDGE] Warning: ESP32 at ${this.esp32Url} unreachable. Using cached telemetry.`);
      }
      this.state.esp32_online = false;

      // Ambient simulation jitter if offline
      if (this.state.sync_errors > 2) {
        this.state.bridge_mode = 'SIMULATION';
        const tempJitter = (Math.random() - 0.5) * 0.2;
        const humJitter = (Math.random() - 0.5) * 0.4;
        this.state.temp = parseFloat((this.state.temp + tempJitter).toFixed(1));
        this.state.hum = parseFloat((this.state.hum + humJitter).toFixed(1));
      }
    }
  }

  async forwardRequest(
    pathWithQuery: string,
    options: { method?: string; body?: string; headers?: Record<string, string>; timeout?: number } = {},
  ): Promise<{ statusCode: number; body: string }> {
    return this.rawRequest(pathWithQuery, options);
  }

  private rawRequest(
    pathWithQuery: string,
    options: { method?: string; body?: string; headers?: Record<string, string>; timeout?: number } = {},
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      let targetUrl: URL;
      try {
        targetUrl = new URL(pathWithQuery, this.esp32Url);
      } catch (err) {
        return reject(new Error(`Invalid target URL: ${this.esp32Url} (${err.message})`));
      }

      const isHttps = targetUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const reqOpts = {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 3500,
      };

      const req = client.request(reqOpts, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 200,
            body,
          });
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${reqOpts.timeout}ms`));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  private broadcastHeartbeat() {
    const uptimeSec = Math.floor((Date.now() - this.serverStartTime) / 1000);
    const gridState = this.state.mains ? 'NORMAL' : 'OUTAGE';
    const pinState = this.state.mains ? 0 : 1;
    const linkState = this.state.esp32_online ? `LINKED (${this.esp32Url})` : 'CACHED/SIM';
    this.eventsGateway.broadcast(
      `[STATUS] Uptime: ${uptimeSec}s | Grid: ${gridState} (D18: ${pinState}) | Temp: ${this.state.temp}C | Hum: ${this.state.hum}% | Hardware: ${linkState}`,
    );
  }
}
