import { Test, TestingModule } from '@nestjs/testing';
import { StatusService } from './status.service';
import { DeviceShadowService } from '../device/device-shadow.service';

describe('StatusService', () => {
  let service: StatusService;
  let mockShadowService: Partial<DeviceShadowService>;

  beforeEach(async () => {
    mockShadowService = {
      getShadow: jest.fn().mockReturnValue({
        mains: true,
        temp: 24.5,
        temperature: 24.5,
        hum: 55.0,
        humidity: 55.0,
        uptime_sec: 120,
        wifi_rssi: -50,
        outages: 1,
        last_ir: '0x20DF10EF',
        configured: true,
        bridge_mode: 'LIVE_BRIDGE',
        esp32_url: 'http://192.168.1.150',
        esp32_online: true,
        last_sync: '2026-09-21T12:00:00.000Z',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusService,
        {
          provide: DeviceShadowService,
          useValue: mockShadowService,
        },
      ],
    }).compile();

    service = module.get<StatusService>(StatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return hub status with both temp and temperature keys', () => {
    const status = service.getStatus();
    expect(status.mains).toBe(true);
    expect(status.temp).toBe(24.5);
    expect(status.temperature).toBe(24.5);
    expect(status.hum).toBe(55.0);
    expect(status.humidity).toBe(55.0);
    expect(status.esp32_online).toBe(true);
    expect(status.bridge_mode).toBe('LIVE_BRIDGE');
  });
});
