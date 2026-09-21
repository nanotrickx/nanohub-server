import { Injectable, Logger } from '@nestjs/common';
import { Esp32BridgeService } from '../esp32-bridge/esp32-bridge.service';
import { EventsGateway } from '../events/events.gateway';
import { DeviceTunnelGateway } from '../device/device-tunnel.gateway';
import { DeviceShadowService } from '../device/device-shadow.service';

@Injectable()
export class IrService {
  private readonly logger = new Logger(IrService.name);

  constructor(
    private readonly bridgeService: Esp32BridgeService,
    private readonly eventsGateway: EventsGateway,
    private readonly deviceTunnelGateway: DeviceTunnelGateway,
    private readonly deviceShadowService: DeviceShadowService,
  ) {}

  async sendCode(rawCode: string): Promise<string> {
    const cleanHex = rawCode.trim().replace(/^0x/i, '').toUpperCase();
    const formattedCode = `0x${cleanHex}`;

    // 1. Primary: If ESP32 is connected via outbound persistent WebSocket tunnel, dispatch downlink command
    if (this.deviceTunnelGateway.isDeviceConnected()) {
      try {
        this.logger.log(`Dispatching downlink IR command ${formattedCode} via WebSocket tunnel...`);
        const ack = await this.deviceTunnelGateway.sendCommand('IR_SEND', {
          code: formattedCode,
        });

        this.deviceShadowService.updateShadowPartial({
          last_ir: `Protocol: NEC | HEX: ${formattedCode}`,
        });

        const logMsg = `[IR-TUNNEL] Dispatched ${formattedCode} down active WebSocket tunnel (ACK: ${JSON.stringify(ack)})`;
        this.logger.log(logMsg);
        this.eventsGateway.broadcast(logMsg);
        return JSON.stringify(ack);
      } catch (err) {
        this.logger.warn(`Tunnel command dispatch failed (${err.message}). Falling back to LAN bridge...`);
      }
    }

    // 2. Secondary: If physical ESP32 is reachable via LAN bridge, relay over HTTP
    const state = this.bridgeService.getState();
    if (state.esp32_online) {
      try {
        this.logger.log(`Relaying IR code ${formattedCode} via LAN HTTP bridge...`);
        const res = await this.bridgeService.forwardRequest(
          `/api/ir/send?code=${encodeURIComponent(formattedCode)}`,
          { method: 'POST', timeout: 4000 },
        );
        const logMsg = `[IR-RELAY] Transmitted ${formattedCode} via physical ESP32 blaster`;
        this.logger.log(logMsg);
        this.eventsGateway.broadcast(logMsg);
        return res.body || 'OK';
      } catch (err) {
        this.logger.error(`Failed to relay IR code to hardware: ${err.message}`);
      }
    }

    // 3. Fallback: Local simulation
    this.deviceShadowService.updateShadowPartial({
      last_ir: `Protocol: NEC | HEX: ${formattedCode}`,
    });
    this.bridgeService.updateStatePartial({
      last_ir: `Protocol: NEC | HEX: ${formattedCode}`,
    });

    const simMsg = `[IR-TX-SIM] Modulated GPIO 2 with 38 kHz carrier -> Fired NEC Hex: ${formattedCode}`;
    this.logger.log(simMsg);
    this.eventsGateway.broadcast(simMsg);
    return 'OK (Simulated)';
  }
}
