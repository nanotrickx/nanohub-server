import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class HubConfigDto {
  @ApiProperty({ description: 'Wi-Fi SSID name', example: 'HomeWiFi_2.4G' })
  @IsString()
  @IsNotEmpty()
  ssid: string;

  @ApiProperty({ description: 'Wi-Fi WPA2 pre-shared key', example: 'SuperSecret123', required: false })
  @IsString()
  @IsOptional()
  pass?: string;

  @ApiProperty({ description: 'Sinric Pro App Key', required: false })
  @IsString()
  @IsOptional()
  appkey?: string;

  @ApiProperty({ description: 'Sinric Pro App Secret', required: false })
  @IsString()
  @IsOptional()
  appsecret?: string;

  @ApiProperty({ description: 'Sinric Pro Mains Power Contact Sensor ID', required: false })
  @IsString()
  @IsOptional()
  mains_id?: string;

  @ApiProperty({ description: 'Sinric Pro Climate Temperature Sensor ID', required: false })
  @IsString()
  @IsOptional()
  temp_id?: string;
}
