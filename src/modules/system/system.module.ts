import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { Esp32BridgeModule } from '../esp32-bridge/esp32-bridge.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [Esp32BridgeModule, EventsModule],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
