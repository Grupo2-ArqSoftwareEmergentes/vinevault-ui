import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { DeviceDetailPanelComponent } from './device-detail-panel.component';
import { DeviceInfoCardComponent } from '../device-info-card/device-info-card.component';
import { DeviceThresholdsCardComponent } from '../device-thresholds-card/device-thresholds-card.component';
import { DeviceCardComponent } from '../device-card/device-card.component';
import { Device } from '../../../domain/services/device-query-service';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import { METRIC_THRESHOLD_DEFINITIONS } from '../../../domain/model/valueobjects/metric-threshold.value-object';
import { DeviceTelemetrySnapshot } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { PREFERRED_LANGUAGE_STORAGE_KEY } from '../../../../core/i18n/language';

const device: Device = {
  id: { value: 'device-1' }, name: 'Sensor 0001', serialNumber: 'SN-0001', hardwareId: { value: 'VINE-A001' },
  status: 'OFFLINE', spaceId: { value: 'space-1' }, ownerUserId: { value: '1' },
  configuration: {}, thresholds: [], deviceType: 'air-quality-v1', activatedAt: null, lastSeenAt: null, createdAt: null, updatedAt: null,
};
const thresholds: DeviceThreshold[] = METRIC_THRESHOLD_DEFINITIONS.map(definition => ({
  id: definition.metric, deviceId: device.id, metric: definition.metric, metricLabel: definition.label,
  metricUnit: definition.unit, value: definition.defaultValue, enabled: true, createdAt: null, updatedAt: null,
}));
const telemetry: DeviceTelemetrySnapshot = {
  connectivityStatus: 'CONNECTED', connectivitySignalStrength: -62, uptime: 93780, healthStatus: 97,
  lastUpdateMinutes: 2, network: 'Cava Wi-Fi', location: 'Lima', temperature: 14, humidity: 72, occurredAt: '2026-11-21T12:00:00Z',
};

describe('Device detail presentation and preserved controls', () => {
  let fixture: ComponentFixture<DeviceDetailPanelComponent>;
  const configure = signal(true);
  beforeEach(async () => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); configure.set(true);
    TestBed.configureTestingModule({ imports: [DeviceDetailPanelComponent, DeviceCardComponent], providers: [
      { provide: WorkspaceAccessService, useValue: { can: () => configure() } },
    ] });
    fixture = TestBed.createComponent(DeviceDetailPanelComponent);
    fixture.componentRef.setInput('device', device);
    fixture.componentRef.setInput('thresholds', thresholds);
    await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); document.documentElement.lang = 'es'; });

  for (const [status, label] of [
    ['ONLINE', 'En línea'], ['OFFLINE', 'Sin conexión'], ['STANDBY', 'En espera'], ['MAINTENANCE', 'Mantenimiento'], ['ERROR', 'Error del dispositivo'], ['DECOMMISSIONED', 'Retirado'],
  ] as const) it(`provides a textual ${status} badge, independent from missing telemetry`, async () => {
    fixture.componentRef.setInput('device', { ...device, status }); await fixture.whenStable();
    const badge = fixture.nativeElement.querySelector('.status-badge');
    expect(badge.textContent.trim()).toBe(label);
    expect(badge.getAttribute('data-status')).toBe(status);
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Sensor 0001');
    expect(fixture.nativeElement.querySelectorAll('.metric-item')).toHaveLength(4);
  });

  it('keeps all reported telemetry and network/location values with legible units', async () => {
    fixture.componentRef.setInput('telemetry', telemetry); await fixture.whenStable();
    expect(Array.from(fixture.nativeElement.querySelectorAll('.metric-number'), (element: any) => element.textContent.trim())).toEqual(['-62', '1d 2h', '97', '2']);
    expect(Array.from(fixture.nativeElement.querySelectorAll('.metric-unit'), (element: any) => element.textContent.trim())).toEqual(['dBm', '%', 'm']);
    expect(fixture.nativeElement.querySelector('.device-info').textContent).toContain('Cava Wi-Fi');
    expect(fixture.nativeElement.querySelector('.device-info').textContent).toContain('Lima');
  });

  it('distinguishes no telemetry from real zero readings without inventing measurements', async () => {
    expect(fixture.nativeElement.querySelectorAll('.metric-number--empty')).toHaveLength(4);
    expect(Array.from(fixture.nativeElement.querySelectorAll('.metric-number'), (element: any) => element.textContent)).toEqual(['--', '--', '--', '--']);
    expect(fixture.nativeElement.querySelectorAll('.info-value--empty')).toHaveLength(2);
    fixture.componentRef.setInput('telemetry', { ...telemetry, connectivitySignalStrength: 0, uptime: 0, healthStatus: 0, lastUpdateMinutes: 0 }); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.metric-number--empty')).toHaveLength(0);
    expect(Array.from(fixture.nativeElement.querySelectorAll('.metric-number'), (element: any) => element.textContent)).toEqual(['0', '0s', '0', '0']);
  });

  it('renders the four server thresholds with distinct families and presentation-only °C formatting', () => {
    expect(Array.from(fixture.nativeElement.querySelectorAll('.threshold-number'), (element: any) => element.textContent.trim())).toEqual(['12', '16', '65', '80']);
    expect(Array.from(fixture.nativeElement.querySelectorAll('.threshold-unit'), (element: any) => element.textContent)).toEqual(['°C', '°C', '%', '%']);
    expect(fixture.nativeElement.querySelectorAll('.threshold-card--humidity')).toHaveLength(2);
    expect(thresholds[0].metricUnit).toBe('C');
    expect(fixture.nativeElement.querySelector('.thresholds-subtitle').textContent).toContain('Puede afectar');
  });

  it('shows unknown thresholds as -- instead of hardcoded example defaults', async () => {
    fixture.componentRef.setInput('thresholds', null); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.threshold-number--empty')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('.thresholds-container').textContent).not.toContain('65');
  });

  it('updates badge, metric labels, units and empty states in English without translating device data', async () => {
    TestBed.inject(I18nService).setLanguage('en'); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.status-badge').textContent.trim()).toBe('Offline');
    expect(fixture.nativeElement.querySelector('.metric-label').textContent).toBe('CONNECTIVITY');
    expect(fixture.nativeElement.querySelector('.thresholds-title').textContent).toBe('Thresholds');
    expect(fixture.nativeElement.querySelector('.threshold-label').textContent).toBe('Temperature min');
    expect(fixture.nativeElement.querySelector('.info-value').textContent).toBe('No data');
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Sensor 0001');
    expect(fixture.nativeElement.querySelector('.back-button').getAttribute('aria-label')).toBe('Go back');
  });

  it('preserves back, power, edit, delete and thresholds output wiring', () => {
    const panel = fixture.componentInstance;
    const back = vi.spyOn(panel.backRequested, 'emit'), power = vi.spyOn(panel.powerToggleRequested, 'emit');
    const edit = vi.spyOn(panel.editRequested, 'emit'), remove = vi.spyOn(panel.deleteRequested, 'emit');
    const range = vi.spyOn(panel.thresholdsEditRequested, 'emit');
    fixture.nativeElement.querySelector('.back-button').click();
    fixture.nativeElement.querySelector('.header-actions .action-button').click();
    const info = fixture.debugElement.query(By.directive(DeviceInfoCardComponent)).componentInstance as DeviceInfoCardComponent;
    info.editDevice(); info.deleteDevice();
    fixture.nativeElement.querySelector('app-device-thresholds-card .action-button').click();
    expect(back).toHaveBeenCalledOnce(); expect(power).toHaveBeenCalledOnce();
    expect(edit).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce(); expect(range).toHaveBeenCalledOnce();
  });

  it('retains role restrictions on all configuration controls, without hiding telemetry or back navigation', async () => {
    configure.set(false); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.header-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-device-thresholds-card .action-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.back-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.metric-item')).toHaveLength(4);
    expect(fixture.debugElement.query(By.directive(DeviceThresholdsCardComponent))).toBeTruthy();
  });

  it('shows recent -88 dBm / Wokwi telemetry as online in detail, grid and list, independently of poor signal quality', async () => {
    const connected = { ...device, status: 'ONLINE', isOnline: true };
    const weak = { ...telemetry, connectivitySignalStrength: -88, network: 'Wokwi-GUEST', lastUpdateMinutes: 2 };
    fixture.componentRef.setInput('device', connected); fixture.componentRef.setInput('telemetry', weak); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.status-badge').textContent).toContain('En línea');
    expect(fixture.nativeElement.querySelector('.metric-number').textContent).toBe('-88');
    expect(fixture.nativeElement.querySelector('.device-info').textContent).toContain('Wokwi-GUEST');
    expect(fixture.nativeElement.querySelector('.action-button--on')).toBeTruthy();
    const card = TestBed.createComponent(DeviceCardComponent);
    card.componentRef.setInput('device', connected); card.componentRef.setInput('telemetry', weak);
    for (const view of ['grid', 'list']) {
      card.componentRef.setInput('viewMode', view); await card.whenStable();
      expect(card.nativeElement.querySelector('.connection-badge').textContent).toContain('En línea');
      expect(card.nativeElement.querySelector('.status-icon').style.backgroundColor).toBe('rgb(16, 185, 129)');
    }
    card.destroy();
  });
});
