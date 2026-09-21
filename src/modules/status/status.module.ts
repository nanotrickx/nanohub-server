import { Module } from '@nestjs/common';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';
import { Esp32BridgeModule } from '../esp32-bridge/esp32-bridge.module';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [Esp32BridgeModule, DeviceModule],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}
