import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SetBridgeTargetDto {
  @ApiProperty({
    description: 'Target IP or hostname of physical ESP32 (e.g. http://192.168.1.150 or http://homehub.local)',
    example: 'http://192.168.1.150',
  })
  @IsString()
  @IsNotEmpty()
  url: string;
}
