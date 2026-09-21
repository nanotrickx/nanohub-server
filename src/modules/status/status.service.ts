import { Injectable } from '@nestjs/common';
import { Esp32BridgeService } from '../esp32-bridge/esp32-bridge.service';
import { HubStatusDto } from './dto/hub-status.dto';

@Injectable()
export class StatusService {
  private readonly startTime = Date.now();

  constructor(private readonly bridgeService: Esp32BridgeService) {}

  getStatus(): HubStatusDto {
    const bridgeState = this.bridgeService.getState();
    const serverUptimeSec = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      mains: bridgeState.mains,
      temp: bridgeState.temp,
      temperature: bridgeState.temp,
      hum: bridgeState.hum,
      humidity: bridgeState.hum,
      uptime_sec: bridgeState.esp32_online ? bridgeState.uptime_sec : serverUptimeSec,
      wifi_rssi: bridgeState.wifi_rssi,
      outages: bridgeState.outages,
      last_ir: bridgeState.last_ir,
      configured: bridgeState.configured,
      bridge_mode: bridgeState.bridge_mode,
      esp32_url: bridgeState.esp32_url,
      esp32_online: bridgeState.esp32_online,
      last_sync: bridgeState.last_sync,
    };
  }
}
