import { ApiProperty } from '@nestjs/swagger';

export class HubStatusDto {
  @ApiProperty({ description: 'Grid power active state (true = 5V grid present, false = outage)', example: true })
  mains: boolean;

  @ApiProperty({ description: 'DHT11 ambient temperature in Celsius', example: 25.4 })
  temp: number;

  @ApiProperty({ description: 'Alias for temp (compatibility with alternate clients)', example: 25.4 })
  temperature: number;

  @ApiProperty({ description: 'DHT11 relative humidity percentage', example: 58.0 })
  hum: number;

  @ApiProperty({ description: 'Alias for hum (compatibility with alternate clients)', example: 58.0 })
  humidity: number;

  @ApiProperty({ description: 'System uptime in seconds', example: 1240 })
  uptime_sec: number;

  @ApiProperty({ description: 'Wi-Fi RSSI signal strength in dBm', example: -54 })
  wifi_rssi: number;

  @ApiProperty({ description: 'Cumulative power grid outages counter', example: 2 })
  outages: number;

  @ApiProperty({ description: 'Last captured or fired IR hex code', example: 'Protocol: NEC | HEX: 0x20DF10EF' })
  last_ir: string;

  @ApiProperty({ description: 'Whether the hub has completed provisioning', example: true })
  configured: boolean;

  @ApiProperty({ description: 'Active bridge operating mode (LIVE_BRIDGE or SIMULATION)', example: 'LIVE_BRIDGE' })
  bridge_mode: string;

  @ApiProperty({ description: 'Target ESP32 URL', example: 'http://192.168.1.150' })
  esp32_url: string;

  @ApiProperty({ description: 'Whether connection with physical ESP32 is currently healthy', example: true })
  esp32_online: boolean;

  @ApiProperty({ description: 'ISO timestamp of last successful hardware synchronization', example: '2026-09-21T13:15:00.000Z', nullable: true })
  last_sync: string | null;
}
