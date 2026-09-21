import { Injectable, Logger } from '@nestjs/common';
import { Esp32BridgeService } from '../esp32-bridge/esp32-bridge.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class IrService {
  private readonly logger = new Logger(IrService.name);

  constructor(
    private readonly bridgeService: Esp32BridgeService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async sendCode(rawCode: string): Promise<string> {
    const cleanHex = rawCode.trim().replace(/^0x/i, '').toUpperCase();
    const formattedCode = `0x${cleanHex}`;

    const state = this.bridgeService.getState();

    // If physical ESP32 is online, relay directly to hardware
    if (state.esp32_online) {
      try {
        this.logger.log(`Relaying IR code ${formattedCode} to physical ESP32...`);
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

    // Local simulation fallback
    this.bridgeService.updateStatePartial({
      last_ir: `Protocol: NEC | HEX: ${formattedCode}`,
    });
    const simMsg = `[IR-TX-SIM] Modulated GPIO 2 with 38 kHz carrier -> Fired NEC Hex: ${formattedCode}`;
    this.logger.log(simMsg);
    this.eventsGateway.broadcast(simMsg);
    return 'OK (Simulated)';
  }
}
