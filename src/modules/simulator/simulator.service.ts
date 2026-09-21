import { Injectable, Logger } from '@nestjs/common';
import { Esp32BridgeService } from '../esp32-bridge/esp32-bridge.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class SimulatorService {
  private readonly logger = new Logger(SimulatorService.name);
  private recentLogs: Array<{ time: string; msg: string }> = [];

  constructor(
    private readonly bridgeService: Esp32BridgeService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  toggleMains(stateOverride?: boolean): { success: boolean; mains: boolean } {
    const current = this.bridgeService.getState();
    const newMains = stateOverride !== undefined ? stateOverride : !current.mains;
    const outages = !newMains ? current.outages + 1 : current.outages;

    this.bridgeService.updateStatePartial({
      mains: newMains,
      outages,
    });

    const msg = !newMains
      ? `[BUZZER] >>> SIMULATED OUTAGE: Sounding 3 Warning Beeps (Cut #${outages}) <<<`
      : `[BUZZER] >>> SIMULATED RESTORE: Sounding Confirmation Tone <<<`;

    this.logger.log(msg);
    this.eventsGateway.broadcast(msg);
    this.addLog(msg);

    return { success: true, mains: newMains };
  }

  injectIr(code: string): { success: boolean; last_ir: string } {
    const formatted = code.startsWith('Protocol:') ? code : `Protocol: NEC | HEX: ${code}`;
    this.bridgeService.updateStatePartial({ last_ir: formatted });

    const msg = `[IR-RX-SIM] Captured signal: ${formatted}`;
    this.logger.log(msg);
    this.eventsGateway.broadcast(msg);
    this.addLog(msg);

    return { success: true, last_ir: formatted };
  }

  getLogs(): Array<{ time: string; msg: string }> {
    return [...this.recentLogs];
  }

  private addLog(msg: string) {
    this.recentLogs.unshift({ time: new Date().toLocaleTimeString(), msg });
    if (this.recentLogs.length > 100) this.recentLogs.pop();
  }
}
