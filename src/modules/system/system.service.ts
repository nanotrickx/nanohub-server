import { Injectable, Logger } from '@nestjs/common';
import { Esp32BridgeService } from '../esp32-bridge/esp32-bridge.service';
import { EventsGateway } from '../events/events.gateway';
import { HubConfigDto } from './dto/hub-config.dto';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly bridgeService: Esp32BridgeService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async resetHub(): Promise<string> {
    const state = this.bridgeService.getState();
    if (state.esp32_online) {
      try {
        this.logger.log('Relaying factory reset command to ESP32...');
        const res = await this.bridgeService.forwardRequest('/api/reset', { method: 'POST', timeout: 3000 });
        this.eventsGateway.broadcast('[SYS] Factory Reset command executed on physical ESP32');
        return res.body || 'Resetting hardware...';
      } catch (err) {
        this.logger.error(`Error relaying reset to ESP32: ${err.message}`);
      }
    }

    const logMsg = '[SYS] Factory Reset simulated: Clearing configuration...';
    this.logger.log(logMsg);
    this.eventsGateway.broadcast(logMsg);
    return 'Resetting hardware (Simulated)...';
  }

  async configureHub(dto: HubConfigDto): Promise<{ status: string; message?: string }> {
    const ssidLabel = dto.ssid || 'Sinric Pro Config';
    const state = this.bridgeService.getState();
    if (state.esp32_online) {
      try {
        this.logger.log(`Relaying configuration for: "${ssidLabel}" to ESP32...`);
        const postData = new URLSearchParams(dto as any).toString();
        const res = await this.bridgeService.forwardRequest('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postData,
          timeout: 5000,
        });
        this.eventsGateway.broadcast(`[CONFIG] Saved configuration for "${ssidLabel}" on ESP32`);
        try {
          return JSON.parse(res.body);
        } catch {
          return { status: 'success', message: res.body };
        }
      } catch (err) {
        this.logger.error(`Error relaying config: ${err.message}`);
      }
    }

    this.eventsGateway.broadcast(`[CONFIG-SIM] Received configuration for "${ssidLabel}"`);
    return { status: 'success', message: 'Simulated configuration stored' };
  }

  async scanWifi(): Promise<{ networks: Array<{ ssid: string; rssi: number; secure: boolean }> }> {
    const state = this.bridgeService.getState();
    if (state.esp32_online) {
      try {
        const res = await this.bridgeService.forwardRequest('/api/wifi/scan', { timeout: 6000 });
        return JSON.parse(res.body);
      } catch (err) {
        this.logger.warn(`WiFi scan relay failed: ${err.message}. Returning mock networks.`);
      }
    }

    return {
      networks: [
        { ssid: 'HomeNetwork_2.4G', rssi: -45, secure: true },
        { ssid: 'IoT_Smart_Devices', rssi: -58, secure: true },
        { ssid: 'Community_Open', rssi: -83, secure: false },
      ],
    };
  }
}
