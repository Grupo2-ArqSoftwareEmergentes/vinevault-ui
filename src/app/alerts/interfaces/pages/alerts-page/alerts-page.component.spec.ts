import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AlertsPageComponent } from './alerts-page.component';
import { DEVICE_QUERY_SERVICE, Space } from '../../../../device/domain/services/device-query-service';
import { DEVICE_COMMAND_SERVICE } from '../../../../device/domain/services/device-command-service';
import { DeviceAlertQueryServiceImpl } from '../../../application/internal/queryservices/device-alert-query-service.impl';
import { DeviceAlert } from '../../../domain/services/device-alert-query-service';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { createOrganizationId } from '../../../../device/domain/model/valueobjects/organization-id.value-object';
import { createUserId } from '../../../../device/domain/model/valueobjects/user-id.value-object';
import { createDeviceId } from '../../../../device/domain/model/valueobjects/device-id.value-object';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { WorkspaceApiService } from '../../../../shared/services/workspace-api.service';
import { createWineCellarId } from '../../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { PREFERRED_LANGUAGE_STORAGE_KEY } from '../../../../core/i18n/language';

const space: Space = {
  id: createSpaceId('space-1'), name: 'Reserve', organizationId: createOrganizationId('org-1'),
  ownerUserId: createUserId('user-1'), createdAt: null, updatedAt: null,
};
const active: DeviceAlert = {
  id: 'alert-1', deviceId: createDeviceId('device-1'), assignmentId: 'assignment-1', spaceId: space.id,
  deviceName: 'Sensor 0001', serialNumber: 'SN-0001', cellarName: null, cellarId: null,
  metric: 'HUMIDITY', thresholdMetric: 'humidity_min', thresholdValue: '65.000000', actualValue: '60.260000',
  message: 'Humidity below configured minimum', status: 'ACTIVE',
  occurredAt: '2026-11-14T10:00:00Z', resolvedAt: null, createdAt: '', updatedAt: '',
};
const resolved: DeviceAlert = { ...active, id: 'alert-2', status: 'RESOLVED', cellarName: 'Cava Principal',
  occurredAt: '2026-11-14T09:00:00Z', resolvedAt: '2026-11-14T09:30:00Z' };

describe('Space-wide alerts', () => {
  let fixture: ComponentFixture<AlertsPageComponent>;
  let component: AlertsPageComponent;
  const loadAlerts = vi.fn(() => of<readonly DeviceAlert[]>([active, resolved]));
  beforeEach(async () => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    localStorage.removeItem('vinevault.workspace-selection');
    loadAlerts.mockReset().mockReturnValue(of([active, resolved]));
    TestBed.configureTestingModule({ imports: [AlertsPageComponent], providers: [
      provideRouter([]),
      { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [], cellars: [] }) } },
      { provide: DeviceAlertQueryServiceImpl, useValue: { handleGetAlertsBySpace: loadAlerts } },
      { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: () => of([]) } },
      { provide: DEVICE_COMMAND_SERVICE, useValue: {} },
    ] });
    fixture = TestBed.createComponent(AlertsPageComponent); component = fixture.componentInstance;
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy(); vi.useRealTimers();
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); localStorage.removeItem('vinevault.workspace-selection');
    document.documentElement.lang = 'es';
  });
  it('does not request alerts without a selected space', () => {
    expect(loadAlerts).not.toHaveBeenCalled(); expect(fixture.nativeElement.textContent).toContain('Selecciona un espacio');
  });
  it('immediately renders unlinked alerts and counters from one space request, without decimal tails or inner boxes', async () => {
    component.selectSpace(space); await fixture.whenStable();
    expect(loadAlerts).toHaveBeenCalledExactlyOnceWith(space.id);
    expect(component.activeAlertsCount).toBe(1); expect(component.historyAlertsCount).toBe(2);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cellar-pill')?.textContent).toBe('Sin cava');
    expect(el.querySelector('.alert-device')?.textContent).toBe('Sensor 0001');
    expect(el.querySelector('.alert-message')?.textContent).toBe('Humedad por debajo del mínimo');
    expect(el.querySelector('.status-pill')?.textContent?.trim()).toBe('Activa');
    expect(el.querySelector('.alert-meta')?.textContent).toContain('65 %');
    expect(el.textContent).not.toContain('65.000000');
    expect(el.querySelector('.comparison-card')).toBeNull();
    expect(component.formatMeasurement('23.170000', 'TEMPERATURE')).toMatch(/23[.,]2 °C/);
    expect(component.formatMeasurement('bad', 'HUMIDITY')).toBe('—');
  });
  it('switches history locally and shows current cellar labels and resolved state', async () => {
    component.selectSpace(space); await fixture.whenStable();
    fixture.nativeElement.querySelectorAll('.toggle-button')[1].click(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.alert-card').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Cava Principal');
    expect(fixture.nativeElement.querySelector('[data-status="RESOLVED"]').textContent.trim()).toBe('Resuelta');
    expect(fixture.nativeElement.querySelectorAll('.toggle-button')[1].getAttribute('aria-pressed')).toBe('true');
    expect(loadAlerts).toHaveBeenCalledTimes(1);
  });
  for (const linked of [true, false]) it(`ignores the global cellar filter (${linked ? 'linked' : 'empty'} cellar)`, async () => {
    const workspace = TestBed.inject(WorkspaceContextService);
    workspace.spaces.set([space]);
    workspace.updateCellars(space.id.value, [{ id: createWineCellarId('cellar-1'), spaceId: space.id, name: 'Reserve',
      description: null, deviceId: linked ? createDeviceId('another-device') : null, createdAt: null, updatedAt: null }]);
    workspace.chooseCellar('cellar-1', false); await fixture.whenStable();
    expect(loadAlerts).toHaveBeenCalledWith(space.id); expect(component.activeAlertsCount).toBe(1);
    expect(fixture.nativeElement.querySelector('.cellar-pill').textContent).toBe('Sin cava');
  });
  it('reacts to language changes without fetching or translating user names', async () => {
    component.selectSpace(space); component.setAlertsMode('history'); await fixture.whenStable();
    TestBed.inject(I18nService).setLanguage('en'); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Humidity below minimum');
    expect(fixture.nativeElement.textContent).toContain('Humidity back within range');
    expect(fixture.nativeElement.textContent).toContain('No cellar');
    expect(fixture.nativeElement.textContent).toContain('Cava Principal');
    expect(loadAlerts).toHaveBeenCalledTimes(1);
  });
  it('routes to the device in the alert space rather than a conflicting persisted space', async () => {
    component.selectSpace(space); await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('.open-device-button').click();
    expect(navigate).toHaveBeenCalledWith(['/devices'], { queryParams: { deviceId: 'device-1', spaceId: 'space-1' } });
  });
  it('cancels stale requests on space changes and clears counters without a space', async () => {
    const pending = new Subject<readonly DeviceAlert[]>(); loadAlerts.mockReturnValueOnce(pending);
    component.selectSpace(space); component.selectSpace({ ...space, id: createSpaceId('space-2') });
    pending.next([active]); await fixture.whenStable();
    expect(component.activeAlertsCount).toBe(0);
    component.clearSelectedSpace(); expect(component.historyAlertsCount).toBe(0); expect(component.loadingAlerts).toBe(false);
  });
  it('shows failures honestly and polling recovers with an updated cellar label', async () => {
    vi.useFakeTimers(); component.selectSpace(space);
    loadAlerts.mockReturnValueOnce(throwError(() => new Error('offline')));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(component.errorAlerts).toBeTruthy(); expect(component.activeAlertsCount).toBe(1);
    loadAlerts.mockReturnValueOnce(of([{ ...active, cellarName: 'Reserva' }]));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(component.errorAlerts).toBe(''); expect(component.historyAlertsCount).toBe(1);
    expect(component.activeAlerts[0].alert.cellarName).toBe('Reserva');
  });
  it('shows empty states only for successful empty responses', async () => {
    loadAlerts.mockReturnValueOnce(of([])); component.selectSpace(space); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.state-row--empty').textContent).toContain('No hay alertas activas');
  });
  it('does not present an initial outage as an empty account', async () => {
    loadAlerts.mockReturnValueOnce(throwError(() => new Error('offline')));
    component.selectSpace(space); await fixture.whenStable();
    expect(component.loadingAlerts).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.state-row--empty')).toBeNull();
  });
});
