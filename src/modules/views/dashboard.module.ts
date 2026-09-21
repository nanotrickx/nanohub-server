import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { Esp32BridgeModule } from '../esp32-bridge/esp32-bridge.module';

@Module({
  imports: [Esp32BridgeModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
