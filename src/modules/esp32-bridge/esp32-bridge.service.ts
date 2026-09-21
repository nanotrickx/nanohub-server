import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from '../events/events.gateway';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as dns from 'dns';
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
  resolved_ip?: string | null;
  esp32_online: boolean;
  last_sync: string | null;
  sync_errors: number;
}

@Injectable()
export class Esp32BridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Esp32BridgeService.name);
  private esp32Url: string;
  private resolvedIp: string | null = null;
  private isDiscovering = false;
  private lastDiscoveryTime = 0;
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
    resolved_ip: null,
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
    this.logger.log(`Initialized ESP32 Bridge Service. Configured Target: ${this.esp32Url}`);
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
    this.resolvedIp = null;
    this.state.esp32_url = this.esp32Url;
    this.state.resolved_ip = null;
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

        const effectiveDest = this.resolvedIp ? `${this.esp32Url} [${this.resolvedIp}]` : this.esp32Url;
        if (!this.state.esp32_online) {
          this.logger.log(`Linked to physical ESP32 at: ${effectiveDest}`);
          this.eventsGateway.broadcast(`[BRIDGE] Linked to physical ESP32 at: ${effectiveDest}`);
        }

        this.state.esp32_online = true;
        this.state.bridge_mode = 'LIVE_BRIDGE';
        this.state.resolved_ip = this.resolvedIp;
        this.state.last_sync = new Date().toISOString();
        this.state.sync_errors = 0;
      } else {
        throw new Error(`ESP32 returned HTTP ${res.statusCode}`);
      }
    } catch (err) {
      this.state.sync_errors++;
      const targetLabel = this.resolvedIp ? `${this.esp32Url} [${this.resolvedIp}]` : this.esp32Url;
      
      if (this.state.esp32_online) {
        this.logger.warn(`Lost connection with ESP32 at ${targetLabel}: ${err.message}. Serving cached telemetry.`);
        this.eventsGateway.broadcast(`[BRIDGE] Warning: ESP32 at ${targetLabel} unreachable. Using cached telemetry.`);
      }
      this.state.esp32_online = false;

      // Trigger self-healing auto-discovery if target is .local and errors accumulate
      if (this.esp32Url.includes('.local') && this.state.sync_errors >= 2) {
        this.triggerAutoDiscovery();
      }

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

      // If we resolved an IP for a .local domain, connect to the IP directly while maintaining the Host header
      const isLocalDomain = targetUrl.hostname.endsWith('.local');
      const connectHostname = (isLocalDomain && this.resolvedIp) ? this.resolvedIp : targetUrl.hostname;

      const headers: Record<string, string> = { ...options.headers };
      if (isLocalDomain && this.resolvedIp && !headers['Host'] && !headers['host']) {
        headers['Host'] = targetUrl.host;
      }

      const reqOpts: http.RequestOptions = {
        protocol: targetUrl.protocol,
        hostname: connectHostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method: options.method || 'GET',
        headers,
        family: 4, // Force IPv4 to eliminate mDNS IPv6 AAAA record timeout delays
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

  /**
   * Autonomous Subnet Auto-Discovery Fallback
   * Detects local private subnets and probes for ESP32 Universal Home Hub signature.
   */
  private async triggerAutoDiscovery(): Promise<void> {
    const now = Date.now();
    // Debounce discovery to at most once every 10 seconds
    if (this.isDiscovering || now - this.lastDiscoveryTime < 10000) {
      return;
    }

    this.isDiscovering = true;
    this.lastDiscoveryTime = now;
    this.logger.log(`[DISCOVERY] Initiating self-healing subnet scan for ${this.esp32Url}...`);

    try {
      // 1. Try quick IPv4 DNS lookup first
      const hostname = new URL(this.esp32Url).hostname;
      const dnsIp = await new Promise<string | null>((resolve) => {
        dns.lookup(hostname, { family: 4 }, (err, address) => {
          if (!err && address) resolve(address);
          else resolve(null);
        });
      });

      if (dnsIp) {
        const verified = await this.verifyHubEndpoint(dnsIp);
        if (verified) {
          this.resolvedIp = dnsIp;
          this.state.resolved_ip = dnsIp;
          this.logger.log(`[DISCOVERY] mDNS resolved ${hostname} -> ${dnsIp}`);
          this.isDiscovering = false;
          await this.syncHardware();
          return;
        }
      }

      // 2. Discover local active IPv4 subnets
      const subnets = this.getLocalSubnets();
      this.logger.debug(`[DISCOVERY] Scanning subnets: ${subnets.join(', ')}`);

      for (const subnet of subnets) {
        const foundIp = await this.scanSubnetForHub(subnet);
        if (foundIp) {
          this.resolvedIp = foundIp;
          this.state.resolved_ip = foundIp;
          this.logger.log(`[DISCOVERY] Successfully auto-discovered ESP32 Hub at IP: ${foundIp} (Persistent host: ${this.esp32Url})`);
          this.eventsGateway.broadcast(`[DISCOVERY] Auto-discovered ESP32 Hub at ${foundIp}`);
          this.isDiscovering = false;
          await this.syncHardware();
          return;
        }
      }

      this.logger.warn(`[DISCOVERY] Subnet scan completed. No active ESP32 Hub responded on LAN.`);
    } catch (err) {
      this.logger.error(`[DISCOVERY] Discovery error: ${err.message}`);
    } finally {
      this.isDiscovering = false;
    }
  }

  private getLocalSubnets(): string[] {
    const interfaces = os.networkInterfaces();
    const subnets = new Set<string>();

    for (const ifaceName of Object.keys(interfaces)) {
      const ifaceList = interfaces[ifaceName];
      if (!ifaceList) continue;

      for (const addr of ifaceList) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const ip = addr.address;
          if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            const parts = ip.split('.');
            parts.pop(); // Remove host portion for /24
            subnets.add(parts.join('.'));
          }
        }
      }
    }

    return Array.from(subnets);
  }

  private async scanSubnetForHub(subnetPrefix: string): Promise<string | null> {
    const chunkSize = 35;
    for (let start = 1; start <= 254; start += chunkSize) {
      const batch: Promise<string | null>[] = [];
      for (let host = start; host < start + chunkSize && host <= 254; host++) {
        const candidateIp = `${subnetPrefix}.${host}`;
        batch.push(this.verifyHubEndpoint(candidateIp));
      }

      const results = await Promise.all(batch);
      const matched = results.find((ip) => ip !== null);
      if (matched) return matched;
    }
    return null;
  }

  private verifyHubEndpoint(ip: string): Promise<string | null> {
    return new Promise((resolve) => {
      const req = http.get(`http://${ip}/api/status`, { timeout: 400, family: 4 }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode === 200 && body.includes('"mains"') && body.includes('"outages"')) {
              resolve(ip);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  private broadcastHeartbeat() {
    const uptimeSec = Math.floor((Date.now() - this.serverStartTime) / 1000);
    const gridState = this.state.mains ? 'NORMAL' : 'OUTAGE';
    const pinState = this.state.mains ? 0 : 1;
    const dest = this.resolvedIp ? `${this.esp32Url} [${this.resolvedIp}]` : this.esp32Url;
    const linkState = this.state.esp32_online ? `LINKED (${dest})` : 'CACHED/SIM';
    this.eventsGateway.broadcast(
      `[STATUS] Uptime: ${uptimeSec}s | Grid: ${gridState} (D18: ${pinState}) | Temp: ${this.state.temp}C | Hum: ${this.state.hum}% | Hardware: ${linkState}`,
    );
  }
}
