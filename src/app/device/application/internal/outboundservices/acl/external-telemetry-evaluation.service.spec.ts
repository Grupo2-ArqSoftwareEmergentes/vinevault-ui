import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ExternalTelemetryEvaluationService } from './external-telemetry-evaluation.service';
import { deviceUtcTimestamp } from '../../../../domain/model/valueobjects/device-utc';

describe('UTC telemetry timestamps', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-21T12:00:00Z'));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.useRealTimers(); });
  for (const recorded of ['2026-11-21T11:58:00', '2026-11-21T11:58:00Z', '2026-11-21T06:58:00-05:00']) {
    it(`treats ${recorded} as the same 2-minute-old reading`, () => {
      const result = vi.fn(); TestBed.inject(ExternalTelemetryEvaluationService).fetchLatestTelemetryByDevice('sensor-1').subscribe(result);
      TestBed.inject(HttpTestingController).expectOne(req => req.url.endsWith('/sensor-1/telemetry')).flush([
        { occurred_at: recorded, payload: { signal_strength: -88, wifi_status: 'CONNECTED', network_name: 'Wokwi-GUEST', uptime_seconds: 120, health_status: 100 } },
      ]);
      expect(result.mock.calls[0][0].lastUpdateMinutes).toBe(2);
      expect(result.mock.calls[0][0].connectivitySignalStrength).toBe(-88);
      expect(result.mock.calls[0][0].network).toBe('Wokwi-GUEST');
    });
  }
  it('does not reinterpret timestamps with explicit offsets', () => {
    expect(deviceUtcTimestamp('2026-11-21T06:58:00-05:00')).toBe('2026-11-21T06:58:00-05:00');
    expect(deviceUtcTimestamp('2026-11-21T11:58:00.123')).toBe('2026-11-21T11:58:00.123Z');
    expect(deviceUtcTimestamp(null)).toBeNull();
  });
});
