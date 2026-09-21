import { Module } from '@nestjs/common';
import { Esp32BridgeService } from './esp32-bridge.service';
import { Esp32BridgeController } from './esp32-bridge.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [Esp32BridgeController],
  providers: [Esp32BridgeService],
  exports: [Esp32BridgeService],
})
export class Esp32BridgeModule {}
