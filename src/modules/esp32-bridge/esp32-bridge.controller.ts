import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Esp32BridgeService } from './esp32-bridge.service';
import { SetBridgeTargetDto } from './dto/set-target.dto';

@ApiTags('Hardware Bridge')
@Controller('api/bridge')
export class Esp32BridgeController {
  constructor(private readonly bridgeService: Esp32BridgeService) {}

  @Get('target')
  @ApiOperation({ summary: 'Get current hardware bridge target and connection status' })
  getTarget() {
    return this.bridgeService.getState();
  }

  @Post('target')
  @ApiOperation({ summary: 'Dynamically configure target ESP32 hardware IP or domain' })
  @ApiResponse({ status: 200, description: 'Target updated and synchronization initiated' })
  async setTarget(@Body() dto: SetBridgeTargetDto) {
    const state = await this.bridgeService.setTargetUrl(dto.url);
    return {
      success: true,
      esp32_url: state.esp32_url,
      esp32_online: state.esp32_online,
      last_sync: state.last_sync,
    };
  }
}
