import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DeviceCellarDialogComponent } from './device-cellar-dialog';
import { DEVICE_COMMAND_SERVICE } from '../../../domain/services/device-command-service';
import { DEVICE_QUERY_SERVICE } from '../../../domain/services/device-query-service';
import { DeviceCommandServiceImpl } from '../../../application/internal/commandservices/device-command-service.impl';
import { deviceResourceToDomain } from '../../rest/transform/device.transform';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { PREFERRED_LANGUAGE_STORAGE_KEY } from '../../../../core/i18n/language';
import { API_CONFIG } from '../../../../api.config';

const resource = { id: 'device-1', name: 'Mi sensor', serial_number: 'SN-0001', hardware_id: 'VINE-A001', status: 'ONLINE', is_online: true, space_id: 'space-1', cellar_id: 'cellar-1', cellar_name: 'Cava Principal', owner_user_id: '1', configuration: {}, thresholds: [], device_type: 'air-quality-v1', activated_at: null, last_seen_at: null, created_at: null, updated_at: null };
const device = deviceResourceToDomain(resource);
const cellar = { id: { value: 'cellar-1' }, spaceId: { value: 'space-1' }, name: 'Cava Principal', deviceId: device.id, description: null, createdAt: null, updatedAt: null };
describe('Quick device cellar assignment', () => {
  let fixture: ComponentFixture<DeviceCellarDialogComponent>;
  let http: HttpTestingController;
  const allowed = signal(true), close = vi.fn(), load = vi.fn(), getDevice = vi.fn();
  const dialog = { close, disableClose: false };
  beforeEach(async () => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); allowed.set(true); close.mockReset(); dialog.disableClose = false;
    getDevice.mockReset().mockReturnValue(of(device));
    load.mockReset().mockReturnValue(of([cellar, { ...cellar, id: { value: 'cellar-2' }, name: 'Reserva', deviceId: null }, { ...cellar, id: { value: 'busy' }, deviceId: { value: 'other-device' } }, { ...cellar, id: { value: 'foreign' }, spaceId: { value: 'space-2' }, deviceId: null }]));
    TestBed.configureTestingModule({ imports: [DeviceCellarDialogComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: device }, { provide: MatDialogRef, useValue: dialog },
      { provide: DEVICE_COMMAND_SERVICE, useClass: DeviceCommandServiceImpl },
      { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetDeviceById: getDevice } },
      { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: load } },
      { provide: WorkspaceAccessService, useValue: { canConfigure: allowed, space: () => ({ id: device.spaceId }) } },
    ] });
    fixture = TestBed.createComponent(DeviceCellarDialogComponent); http = TestBed.inject(HttpTestingController); await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); http.verify(); localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); document.documentElement.lang = 'es'; });

  it('shows current and free cellars, disables occupied ones and excludes foreign-space options', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(load).toHaveBeenCalledWith('space-1'); expect(select.value).toBe('cellar-1');
    expect(select.options.length).toBe(4); expect(select.options[0].textContent).toBe('Sin cava');
    expect(select.options[1].disabled).toBe(false); expect(select.options[3].disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.dialog-button--primary')).toBeNull();
  });
  it('saves directly when the user chooses an option in the native selector', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'cellar-2'; select.dispatchEvent(new Event('change', { bubbles: true }));
    const request = http.expectOne(req => req.method === 'PUT');
    expect(request.request.body).toEqual({ cellar_id: 'cellar-2' });
    request.flush({ ...resource, cellar_id: 'cellar-2', cellar_name: 'Reserva' });
    expect(close).toHaveBeenCalledOnce();
  });
  for (const target of ['cellar-2', '']) it(`sends one atomic PUT for ${target || 'unlink'} without DELETE/claim/retry`, () => {
    fixture.componentInstance.cellarId.setValue(target); fixture.componentInstance.submit(); fixture.componentInstance.submit();
    const request = http.expectOne(`${API_CONFIG.baseUrl}/api/v1/devices/device-1/cellar`);
    expect(request.request.method).toBe('PUT'); expect(request.request.body).toEqual({ cellar_id: target || null });
    expect(close).not.toHaveBeenCalled(); expect(dialog.disableClose).toBe(true);
    request.flush({ ...resource, cellar_id: target || null, cellar_name: target ? 'Reserva' : null });
    expect(close).toHaveBeenCalledOnce(); expect(close.mock.calls[0][0].cellarId).toBe(target || null);
    expect(dialog.disableClose).toBe(false);
    http.expectNone(req => req.method === 'DELETE' || req.method === 'POST');
  });
  it('keeps the old association and modal open on conflicts; retains selection and does not retry', async () => {
    fixture.componentInstance.cellarId.setValue('cellar-2'); fixture.componentInstance.submit();
    http.expectOne(req => req.method === 'PUT').flush({ detail: 'Wine cellar already has a linked device' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(close).not.toHaveBeenCalled(); expect(fixture.componentInstance.current()).toBe('cellar-1');
    expect(fixture.componentInstance.cellarId.value).toBe('cellar-2'); expect(fixture.componentInstance.saving()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('La cava ya tiene');
    http.expectNone(req => req.method === 'PUT');
  });
  it('fails closed for occupied, foreign or missing choices and missing configuration permission', () => {
    for (const target of ['busy', 'foreign', 'missing']) { fixture.componentInstance.cellarId.setValue(target); fixture.componentInstance.submit(); }
    allowed.set(false); fixture.componentInstance.cellarId.setValue('cellar-2'); fixture.componentInstance.submit();
    http.expectNone(req => req.method === 'PUT'); expect(close).not.toHaveBeenCalled();
  });
  it('requires a successful fresh read before it can change an association', () => {
    getDevice.mockReturnValueOnce(of(null)); fixture.componentInstance.load();
    fixture.componentInstance.cellarId.setValue(''); fixture.componentInstance.submit();
    expect(fixture.componentInstance.ready()).toBe(false); http.expectNone(req => req.method === 'PUT');
    getDevice.mockReturnValueOnce(throwError(() => new Error('offline'))); fixture.componentInstance.load();
    expect(fixture.componentInstance.error()).toBeTruthy();
  });
  it('closes and cancels pending writes after a workspace/authorization change', () => {
    fixture.componentInstance.cellarId.setValue('cellar-2'); fixture.componentInstance.submit();
    const request = http.expectOne(req => req.method === 'PUT');
    TestBed.inject(WorkspaceScopeService).activate(null, true);
    expect(request.cancelled).toBe(true); expect(close).toHaveBeenCalledWith();
    http.expectNone(req => req.method === 'PUT');
  });
  it('updates language in the open selector without changing device/cellar names or the selection', async () => {
    fixture.componentInstance.cellarId.setValue('cellar-2'); TestBed.inject(I18nService).setLanguage('en'); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h2').textContent).toBe('Change cellar');
    expect(fixture.nativeElement.textContent).toContain('Cava Principal');
    expect(fixture.componentInstance.cellarId.value).toBe('cellar-2');
  });
});
