import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SimulatorService } from './simulator.service';

@ApiTags('Testing & Simulation Hooks')
@Controller('api')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('simulate/mains')
  @ApiOperation({ summary: 'Toggle or set simulated mains power grid state' })
  @ApiQuery({ name: 'state', required: false, description: 'Explicit state (true = normal, false = outage)' })
  @ApiResponse({ status: 200, description: 'State toggled' })
  toggleMains(
    @Query('state') queryState?: string,
    @Body() body?: { state?: boolean },
  ) {
    let explicit: boolean | undefined;
    if (queryState !== undefined) {
      explicit = queryState === 'true' || queryState === '1';
    } else if (body && body.state !== undefined) {
      explicit = Boolean(body.state);
    }
    return this.simulatorService.toggleMains(explicit);
  }

  @Post('simulate/ir')
  @ApiOperation({ summary: 'Inject incoming IR signal to test sniffer handler' })
  @ApiQuery({ name: 'code', required: false, description: 'NEC hex code' })
  @ApiResponse({ status: 200, description: 'IR signal injected' })
  injectIr(
    @Query('code') queryCode?: string,
    @Body() body?: { code?: string },
  ) {
    const code = queryCode || body?.code || '0x20DF10EF';
    return this.simulatorService.injectIr(code);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Retrieve recent system event logs' })
  @ApiResponse({ status: 200, description: 'Recent event logs' })
  getLogs() {
    return this.simulatorService.getLogs();
  }
}
