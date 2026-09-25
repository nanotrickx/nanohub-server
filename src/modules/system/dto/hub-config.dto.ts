import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

/**
 * All fields are optional.
 * - Wi-Fi setup: include ssid + pass (and optionally Sinric fields).
 * - Sinric-only update: omit ssid + pass entirely — just send appkey, appsecret, etc.
 *
 * Empty strings are coerced to undefined so @IsOptional() skips them correctly.
 */
export class HubConfigDto {
  @ApiProperty({ description: 'Wi-Fi SSID name', example: 'HomeWiFi_2.4G', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  ssid?: string;

  @ApiProperty({ description: 'Wi-Fi WPA2 pre-shared key', example: 'SuperSecret123', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  pass?: string;

  @ApiProperty({ description: 'Sinric Pro App Key', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  appkey?: string;

  @ApiProperty({ description: 'Sinric Pro App Secret', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  appsecret?: string;

  @ApiProperty({ description: 'Sinric Pro Mains Power Contact Sensor ID', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  mains_id?: string;

  @ApiProperty({ description: 'Sinric Pro Temperature/Climate Sensor ID', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  temp_id?: string;
}
