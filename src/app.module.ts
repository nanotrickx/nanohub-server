import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { EventsModule } from './modules/events/events.module';
import { Esp32BridgeModule } from './modules/esp32-bridge/esp32-bridge.module';
import { StatusModule } from './modules/status/status.module';
import { IrModule } from './modules/ir/ir.module';
import { SystemModule } from './modules/system/system.module';
import { SimulatorModule } from './modules/simulator/simulator.module';
import { DeviceModule } from './modules/device/device.module';
import { DashboardModule } from './modules/views/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    EventsModule,
    DeviceModule,
    Esp32BridgeModule,
    StatusModule,
    IrModule,
    SystemModule,
    SimulatorModule,
    DashboardModule,
  ],
})
export class AppModule {}
