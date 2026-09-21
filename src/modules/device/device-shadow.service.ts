import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';
import { HubStatusDto } from '../status/dto/hub-status.dto';

export interface DeviceInfo {
  deviceId: string;
  mac: string;
  firmware: string;
  ip?: string;
  connectedAt: string;
}

export interface ShadowState {
  mains: boolean;
  temp: number;
  temperature: number;
  hum: number;
  humidity: number;
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
  connection_type: 'OUTBOUND_TUNNEL' | 'LAN_BRIDGE' | 'SIMULATION';
  device_info?: DeviceInfo;
}

@Injectable()
export class DeviceShadowService {
  private readonly logger = new Logger(DeviceShadowService.name);
  private readonly startTime = Date.now();
  private tunnelConnected = false;
  private tunnelHeartbeatTimer: NodeJS.Timeout | null = null;
  private lastTunnelMessageTime = 0;

  private shadow: ShadowState = {
    mains: true,
    temp: 24.5,
    temperature: 24.5,
    hum: 55.0,
    humidity: 55.0,
    uptime_sec: 0,
    wifi_rssi: -55,
    outages: 0,
    last_ir: 'None',
    configured: true,
    bridge_mode: 'LIVE_BRIDGE',
    esp32_url: 'http://homehub.local',
    resolved_ip: null,
    esp32_online: false,
    last_sync: null,
    connection_type: 'SIMULATION',
  };

  constructor(private readonly eventsGateway: EventsGateway) {}

  getShadow(): HubStatusDto {
    const serverUptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      mains: this.shadow.mains,
      temp: this.shadow.temp,
      temperature: this.shadow.temperature,
      hum: this.shadow.hum,
      humidity: this.shadow.humidity,
      uptime_sec: this.shadow.esp32_online ? this.shadow.uptime_sec : serverUptimeSec,
      wifi_rssi: this.shadow.wifi_rssi,
      outages: this.shadow.outages,
      last_ir: this.shadow.last_ir,
      configured: this.shadow.configured,
      bridge_mode: this.shadow.bridge_mode,
      esp32_url: this.shadow.esp32_url,
      resolved_ip: this.shadow.resolved_ip || null,
      esp32_online: this.shadow.esp32_online,
      last_sync: this.shadow.last_sync,
    };
  }

  getRawShadow(): ShadowState {
    return { ...this.shadow };
  }

  isTunnelActive(): boolean {
    return this.tunnelConnected;
  }

  onTunnelConnect(info: DeviceInfo) {
    this.tunnelConnected = true;
    this.lastTunnelMessageTime = Date.now();
    this.shadow.connection_type = 'OUTBOUND_TUNNEL';
    this.shadow.bridge_mode = 'DEVICE_TUNNEL';
    this.shadow.esp32_online = true;
    this.shadow.device_info = info;
    if (info.ip) {
      this.shadow.resolved_ip = info.ip;
    }

    const msg = `[DIGITAL-TWIN] Outbound Device Tunnel established with ${info.deviceId} (${info.mac})!`;
    this.logger.log(msg);
    this.eventsGateway.broadcast(msg);
  }

  onTunnelDisconnect() {
    this.tunnelConnected = false;
    this.logger.warn(`[DIGITAL-TWIN] Device Tunnel disconnected. Falling back to LAN bridge.`);
    this.eventsGateway.broadcast(`[DIGITAL-TWIN] Device Tunnel disconnected. Falling back to LAN bridge.`);
    
    // Switch connection type back to LAN_BRIDGE
    this.shadow.connection_type = 'LAN_BRIDGE';
    this.shadow.bridge_mode = 'LIVE_BRIDGE';
  }

  updateFromTunnelTelemetry(data: any) {
    this.lastTunnelMessageTime = Date.now();
    this.tunnelConnected = true;
    this.shadow.connection_type = 'OUTBOUND_TUNNEL';
    this.shadow.bridge_mode = 'DEVICE_TUNNEL';
    this.shadow.esp32_online = true;
    this.shadow.last_sync = new Date().toISOString();

    const previousMains = this.shadow.mains;
    if (typeof data.mains === 'boolean') {
      this.shadow.mains = data.mains;
    }

    const t = typeof data.temp === 'number' ? data.temp : (typeof data.temperature === 'number' ? data.temperature : null);
    if (t !== null) {
      this.shadow.temp = t;
      this.shadow.temperature = t;
    }

    const h = typeof data.hum === 'number' ? data.hum : (typeof data.humidity === 'number' ? data.humidity : null);
    if (h !== null) {
      this.shadow.hum = h;
      this.shadow.humidity = h;
    }

    if (typeof data.uptime_sec === 'number') this.shadow.uptime_sec = data.uptime_sec;
    if (typeof data.wifi_rssi === 'number') this.shadow.wifi_rssi = data.wifi_rssi;
    if (typeof data.outages === 'number') this.shadow.outages = data.outages;
    if (data.last_ir && data.last_ir !== 'None') this.shadow.last_ir = data.last_ir;
    if (typeof data.configured === 'boolean') this.shadow.configured = data.configured;

    // Outage delta alert
    if (previousMains !== this.shadow.mains) {
      if (!this.shadow.mains) {
        this.shadow.outages++;
        const msg = `[GRID ALERT] *** INSTANT MAINS OUTAGE PUSH from ESP32 Tunnel! (Cut #${this.shadow.outages}) ***`;
        this.logger.warn(msg);
        this.eventsGateway.broadcast(msg);
      } else {
        const msg = `[GRID ALERT] *** INSTANT MAINS RESTORED PUSH from ESP32 Tunnel! ***`;
        this.logger.log(msg);
        this.eventsGateway.broadcast(msg);
      }
    }
  }

  updateFromLanBridge(bridgeState: any) {
    // Only update from LAN bridge if the persistent device tunnel is NOT actively connected
    if (this.tunnelConnected) return;

    this.shadow.mains = bridgeState.mains;
    this.shadow.temp = bridgeState.temp;
    this.shadow.temperature = bridgeState.temp;
    this.shadow.hum = bridgeState.hum;
    this.shadow.humidity = bridgeState.hum;
    this.shadow.uptime_sec = bridgeState.uptime_sec;
    this.shadow.wifi_rssi = bridgeState.wifi_rssi;
    this.shadow.outages = bridgeState.outages;
    this.shadow.last_ir = bridgeState.last_ir;
    this.shadow.configured = bridgeState.configured;
    this.shadow.bridge_mode = bridgeState.bridge_mode;
    this.shadow.esp32_url = bridgeState.esp32_url;
    this.shadow.resolved_ip = bridgeState.resolved_ip || null;
    this.shadow.esp32_online = bridgeState.esp32_online;
    this.shadow.last_sync = bridgeState.last_sync;
    this.shadow.connection_type = bridgeState.esp32_online ? 'LAN_BRIDGE' : 'SIMULATION';
  }

  updateShadowPartial(partial: Partial<ShadowState>) {
    Object.assign(this.shadow, partial);
  }
}
