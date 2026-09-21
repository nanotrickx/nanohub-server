import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StatusService } from './status.service';
import { HubStatusDto } from './dto/hub-status.dto';

@ApiTags('Telemetry')
@Controller('api')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current mains grid status, environmental climate, and hardware telemetry' })
  @ApiResponse({ status: 200, description: 'Live or cached hub status', type: HubStatusDto })
  getStatus(): HubStatusDto {
    return this.statusService.getStatus();
  }
}
