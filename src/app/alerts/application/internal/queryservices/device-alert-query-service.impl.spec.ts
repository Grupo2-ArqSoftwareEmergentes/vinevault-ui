import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { DeviceAlertQueryServiceImpl } from './device-alert-query-service.impl';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { API_CONFIG } from '../../../../api.config';

describe('Space alerts HTTP contract', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  for (const activeOnly of [false, true]) it(`queries the entire space (active_only=${activeOnly}) and maps nullable associations`, () => {
    const next = vi.fn();
    TestBed.inject(DeviceAlertQueryServiceImpl).handleGetAlertsBySpace(createSpaceId('space-1'), activeOnly).subscribe(next);
    const request = http.expectOne(req => req.url === `${API_CONFIG.baseUrl}/api/v1/alerts`);
    expect(request.request.params.get('space_id')).toBe('space-1');
    expect(request.request.params.get('active_only')).toBe(String(activeOnly));
    expect(request.request.params.has('cellar_id')).toBe(false);
    request.flush([{ id: 'alert-1', device_id: 'sensor-1', device_name: 'Mi Sensor', serial_number: 'SN-0001',
      cellar_id: null, cellar_name: null, space_id: 'space-1', threshold_value: '65', actual_value: '60.2' }]);
    expect(next.mock.calls[0][0][0]).toMatchObject({ deviceId: { value: 'sensor-1' }, deviceName: 'Mi Sensor',
      serialNumber: 'SN-0001', cellarName: null, cellarId: null, thresholdValue: '65' });
    http.expectNone(req => req.url.includes('/devices/'));
  });
  it('propagates failures instead of inventing an empty successful response', () => {
    const next = vi.fn(), error = vi.fn();
    TestBed.inject(DeviceAlertQueryServiceImpl).handleGetAlertsBySpace(createSpaceId('space-1')).subscribe({ next, error });
    http.expectOne(req => req.url.endsWith('/alerts')).flush({ detail: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    expect(next).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledOnce();
  });
});
