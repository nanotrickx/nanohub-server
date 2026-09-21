import { Module, forwardRef } from '@nestjs/common';
import { DeviceShadowService } from './device-shadow.service';
import { DeviceTunnelGateway } from './device-tunnel.gateway';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [DeviceShadowService, DeviceTunnelGateway],
  exports: [DeviceShadowService, DeviceTunnelGateway],
})
export class DeviceModule {}
