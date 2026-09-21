import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IrService } from './ir.service';
import { SendIrDto } from './dto/send-ir.dto';

@ApiTags('IR Remote Blaster')
@Controller('api/ir')
export class IrController {
  constructor(private readonly irService: IrService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transmit 38 kHz modulated NEC IR carrier code' })
  @ApiQuery({ name: 'code', required: false, description: 'NEC hex code (e.g. 0x20DF10EF)' })
  @ApiResponse({ status: 200, description: 'IR sequence transmitted successfully' })
  async sendIr(
    @Query('code') queryCode?: string,
    @Body() bodyDto?: Partial<SendIrDto>,
  ): Promise<string> {
    const code = queryCode || bodyDto?.code;
    if (!code) {
      throw new BadRequestException("Missing 'code' parameter (e.g. ?code=0x20DF10EF or JSON body)");
    }
    return this.irService.sendCode(code);
  }
}
