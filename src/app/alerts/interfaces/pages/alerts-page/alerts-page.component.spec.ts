import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AlertsPageComponent } from './alerts-page.component';
import { DeviceQueryServiceImpl } from '../../../../device/application/internal/queryservices/device-query-service.impl';
import { DEVICE_QUERY_SERVICE, Device, Space } from '../../../../device/domain/services/device-query-service';
import { DEVICE_COMMAND_SERVICE } from '../../../../device/domain/services/device-command-service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { DeviceAlertQueryServiceImpl } from '../../../application/internal/queryservices/device-alert-query-service.impl';
import { DeviceAlert } from '../../../domain/services/device-alert-query-service';
import { GetDeviceAlertsByDeviceQuery } from '../../../domain/model/queries/get-device-alerts-by-device.query';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { createOrganizationId } from '../../../../device/domain/model/valueobjects/organization-id.value-object';
import { createUserId } from '../../../../device/domain/model/valueobjects/user-id.value-object';
import { createDeviceId } from '../../../../device/domain/model/valueobjects/device-id.value-object';
import { createHardwareId } from '../../../../device/domain/model/valueobjects/hardware-id.value-object';

const space: Space = {
  id: createSpaceId('space-1'), name: 'Reserve Cellar', organizationId: createOrganizationId('org-1'),
  ownerUserId: createUserId('user-1'), createdAt: null, updatedAt: null,
};
const device: Device = {
  id: createDeviceId('device-1'), name: 'Sensor 1', serialNumber: 'SN-0001', status: 'ONLINE',
  spaceId: space.id, ownerUserId: space.ownerUserId, configuration: {}, thresholds: [],
  hardwareId: createHardwareId('VINE-A001'), deviceType: 'SENSOR', activatedAt: null,
  lastSeenAt: null, createdAt: null, updatedAt: null,
};
const activeAlert: DeviceAlert = {
  id: 'alert-1', deviceId: device.id, assignmentId: null, spaceId: space.id,
  metric: 'TEMPERATURE', thresholdMetric: 'temperature_max', thresholdValue: '25', actualValue: '28',
  message: 'Temperature is above the configured limit', status: 'ACTIVE',
  occurredAt: '2026-11-14T10:00:00Z', resolvedAt: null,
  createdAt: '2026-11-14T10:00:00Z', updatedAt: '2026-11-14T10:00:00Z',
};
const resolvedAlert: DeviceAlert = {
  ...activeAlert, id: 'alert-2', status: 'RESOLVED', message: 'Temperature returned to normal',
  occurredAt: '2026-11-14T09:00:00Z', resolvedAt: '2026-11-14T09:30:00Z',
};

describe('Alerts workspace', () => {
  let fixture: ComponentFixture<AlertsPageComponent>;
  let component: AlertsPageComponent;
  const loadDevices = vi.fn(() => of({ content: [device], totalElements: 1, totalPages: 1, size: 100, number: 0 }));
  const loadAlerts = vi.fn((query: GetDeviceAlertsByDeviceQuery) =>
    of(query.activeOnly ? [activeAlert] : [activeAlert, resolvedAlert]));

  beforeEach(async () => {
    loadDevices.mockReset().mockReturnValue(of({ content: [device], totalElements: 1, totalPages: 1, size: 100, number: 0 }));
    loadAlerts.mockReset().mockImplementation((query: GetDeviceAlertsByDeviceQuery) =>
      of(query.activeOnly ? [activeAlert] : [activeAlert, resolvedAlert]));
    await TestBed.configureTestingModule({
      imports: [AlertsPageComponent],
      providers: [
        provideRouter([]),
        { provide: DeviceQueryServiceImpl, useValue: { handleGetDevicesBySpace: loadDevices } },
        { provide: DeviceAlertQueryServiceImpl, useValue: { handleGetDeviceAlertsByDevice: loadAlerts } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: () => of([]) } },
        { provide: DEVICE_COMMAND_SERVICE, useValue: {} },
        { provide: WineCellarQueryServiceImpl, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AlertsPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('shows the space selection empty state without issuing alert requests', () => {
    expect(fixture.nativeElement.textContent).toContain('Select an organization with spaces to view alerts.');
    expect(loadAlerts).not.toHaveBeenCalled();
  });

  it('loads the existing active and history queries for the selected space', async () => {
    component.selectSpace(space);
    await fixture.whenStable();
    expect(loadDevices).toHaveBeenCalledWith({ spaceId: space.id, page: 0, size: 100 });
    expect(loadAlerts).toHaveBeenCalledWith({ deviceId: device.id, activeOnly: true });
    expect(loadAlerts).toHaveBeenCalledWith({ deviceId: device.id, activeOnly: false });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Active alerts and history');
    expect(element.querySelectorAll('.alert-card').length).toBe(1);
    expect(element.querySelector('.alert-device')?.textContent).toBe('Sensor 1');
    expect(element.querySelector('.alert-serial')?.textContent).toBe('SN-0001');
    expect(element.querySelector('.status-pill')?.getAttribute('data-status')).toBe('ACTIVE');
    expect(element.querySelector('.status-pill')?.getAttribute('style')).toBeNull();
    expect(element.querySelector('.comparison-card--threshold')?.textContent).toContain('25 C');
    expect(element.querySelector('.comparison-card--time')?.textContent).toContain(component.formatTimestamp(activeAlert.occurredAt));
  });

  it('switches filters without refetching and exposes the pressed state', async () => {
    component.selectSpace(space);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = element.querySelectorAll<HTMLButtonElement>('.toggle-button');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    buttons[1].click();
    await fixture.whenStable();
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(element.querySelectorAll('.alert-card').length).toBe(2);
    expect(element.querySelector('[data-status="RESOLVED"]')?.textContent?.trim()).toBe('RESOLVED');
    expect(loadAlerts).toHaveBeenCalledTimes(2);
  });

  it('preserves Open device routing and its deviceId query parameter', async () => {
    component.selectSpace(space);
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('.open-device-button').click();
    expect(navigate).toHaveBeenCalledWith(['/devices'], { queryParams: { deviceId: 'device-1' } });
  });

  it('shows the appropriate empty message for each filter', async () => {
    loadAlerts.mockReturnValue(of([]));
    component.selectSpace(space);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.state-row--empty').textContent).toContain('No active alerts');
    fixture.nativeElement.querySelectorAll('.toggle-button')[1].click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.state-row--empty').textContent).toContain('No alert history');
  });

  it('announces API errors without leaving a loading indicator', async () => {
    loadDevices.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));
    component.selectSpace(space);
    await fixture.whenStable();
    expect(component.loadingAlerts).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();
  });
});
