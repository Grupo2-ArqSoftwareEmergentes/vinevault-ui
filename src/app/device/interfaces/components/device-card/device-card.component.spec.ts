import { TestBed } from '@angular/core/testing';
import { DeviceCardComponent } from './device-card.component';
import { deviceResourceToDomain } from '../../rest/transform/device.transform';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { PREFERRED_LANGUAGE_STORAGE_KEY } from '../../../../core/i18n/language';

describe('Device card cellar/name hierarchy', () => {
  afterEach(() => { localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); document.documentElement.lang = 'es'; });
  for (const mode of ['grid', 'list'] as const) it(`renders cellar then name in ${mode}, never factory name or serial as the title`, async () => {
    const fixture = TestBed.createComponent(DeviceCardComponent);
    const resource = { id: 'device-1', serial_number: 'SN-0001', factory_name: 'Factory label', name: 'Mi sensor de vinos', status: 'OFFLINE', is_online: false, space_id: 'space-1', cellar_id: 'cellar-1', cellar_name: 'Mi colección', owner_user_id: '1', configuration: {}, thresholds: [], hardware_id: 'VINE-A001', device_type: 'air-quality-v1', activated_at: null, last_seen_at: null, created_at: null, updated_at: null };
    const device = deviceResourceToDomain(resource);
    expect(device.cellarId).toBe('cellar-1'); expect(device.cellarName).toBe('Mi colección');
    fixture.componentRef.setInput('device', device); fixture.componentRef.setInput('viewMode', mode); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.badge').textContent).toBe('Mi colección');
    expect(fixture.nativeElement.querySelector('.device-name, .list-name').textContent).toBe('Mi sensor de vinos');
    expect(fixture.nativeElement.textContent).not.toContain('Factory label');
    expect(fixture.nativeElement.textContent).not.toContain('SN-0001');
    fixture.componentRef.setInput('device', { ...device, cellarId: null, cellarName: null }); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.badge--unassigned').textContent).toBe('Sin cava');
    TestBed.inject(I18nService).setLanguage('en'); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.badge').textContent).toBe('No cellar');
    expect(fixture.nativeElement.querySelector('.device-name, .list-name').textContent).toBe('Mi sensor de vinos');
    fixture.destroy();
  });
});
