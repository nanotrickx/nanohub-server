import { Module } from '@nestjs/common';
import { IrService } from './ir.service';
import { IrController } from './ir.controller';
import { Esp32BridgeModule } from '../esp32-bridge/esp32-bridge.module';
import { EventsModule } from '../events/events.module';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [Esp32BridgeModule, EventsModule, DeviceModule],
  controllers: [IrController],
  providers: [IrService],
  exports: [IrService],
})
export class IrModule {}
