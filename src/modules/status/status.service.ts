import { Injectable } from '@nestjs/common';
import { DeviceShadowService } from '../device/device-shadow.service';
import { HubStatusDto } from './dto/hub-status.dto';

@Injectable()
export class StatusService {
  constructor(private readonly deviceShadowService: DeviceShadowService) {}

  getStatus(): HubStatusDto {
    return this.deviceShadowService.getShadow();
  }
}
