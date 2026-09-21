import { Module } from '@nestjs/common';
import { SimulatorService } from './simulator.service';
import { SimulatorController } from './simulator.controller';
import { Esp32BridgeModule } from '../esp32-bridge/esp32-bridge.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [Esp32BridgeModule, EventsModule],
  controllers: [SimulatorController],
  providers: [SimulatorService],
  exports: [SimulatorService],
})
export class SimulatorModule {}
