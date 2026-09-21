import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendIrDto {
  @ApiProperty({
    description: '32-bit NEC hex code to transmit via the 38 kHz blaster (e.g. 0x20DF10EF or 20DF10EF)',
    example: '0x20DF10EF',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
