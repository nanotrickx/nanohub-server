import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { HubConfigDto } from './dto/hub-config.dto';

@ApiTags('System & Provisioning')
@Controller('api')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wipe NVS Flash configuration and trigger ESP32 restart' })
  @ApiResponse({ status: 200, description: 'Hardware reset command dispatched' })
  async reset(): Promise<string> {
    return this.systemService.resetHub();
  }

  @Post('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save Wi-Fi station and Sinric Pro credentials' })
  @ApiResponse({ status: 200, description: 'Credentials stored and reboot initiated' })
  async configure(@Body() dto: HubConfigDto) {
    return this.systemService.configureHub(dto);
  }

  @Get('wifi/scan')
  @ApiOperation({ summary: 'Perform 2.4 GHz RF environment scan for nearby access points' })
  @ApiResponse({ status: 200, description: 'List of visible Wi-Fi access points' })
  async scanWifi() {
    return this.systemService.scanWifi();
  }
}
