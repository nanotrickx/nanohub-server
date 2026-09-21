import { Module } from '@nestjs/common';
import { Esp32BridgeService } from './esp32-bridge.service';
import { Esp32BridgeController } from './esp32-bridge.controller';
import { EventsModule } from '../events/events.module';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [EventsModule, DeviceModule],
  controllers: [Esp32BridgeController],
  providers: [Esp32BridgeService],
  exports: [Esp32BridgeService],
})
export class Esp32BridgeModule {}
