import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PairDeviceDialogComponent } from './pair-device-dialog.component';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellar } from '../../../../cava/domain/services/wine-cellar-query-service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { PREFERRED_LANGUAGE_STORAGE_KEY } from '../../../../core/i18n/language';

const cellar: WineCellar = { id: { value: 'cellar-1' }, spaceId: { value: 'space-1' }, name: 'Mi colección', description: null, deviceId: null, createdAt: null, updatedAt: null };
describe('Optional cellar in sensor hardware modal', () => {
  let fixture: ComponentFixture<PairDeviceDialogComponent>;
  const close = vi.fn(); const load = vi.fn();
  beforeEach(async () => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); close.mockReset(); load.mockReset().mockReturnValue(of([
      cellar, { ...cellar, id: { value: 'occupied' }, name: 'Ocupada', deviceId: { value: 'sensor-2' } },
      { ...cellar, id: { value: 'foreign' }, spaceId: { value: 'space-2' }, name: 'Otro espacio' },
    ]));
    TestBed.configureTestingModule({ imports: [PairDeviceDialogComponent], providers: [
      { provide: MAT_DIALOG_DATA, useValue: { spaceId: 'space-1' } },
      { provide: MatDialogRef, useValue: { close } },
      { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: load } },
    ] });
    fixture = TestBed.createComponent(PairDeviceDialogComponent); await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); document.documentElement.lang = 'es'; });
  it('loads only the active space and defaults to no cellar, disabling occupied cellars', () => {
    expect(load).toHaveBeenCalledExactlyOnceWith('space-1');
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe(''); expect(select.options.length).toBe(3);
    expect(select.options[0].textContent).toBe('Sin asociar a ninguna cava');
    expect(select.options[1].textContent).toBe('Mi colección');
    expect(select.options[2].disabled).toBe(true);
    expect(select.textContent).not.toContain('Otro espacio');
  });
  it('returns the selected cellar with hardware, or omits it for an unassociated sensor', () => {
    fixture.componentInstance.form.patchValue({ hardwareId: 'VINE-A001', cellarId: 'cellar-1' });
    fixture.componentInstance.submit(); expect(close).toHaveBeenCalledWith({ hardwareId: 'VINE-A001', cellarId: 'cellar-1' });
    fixture.componentInstance.form.patchValue({ cellarId: '' }); fixture.componentInstance.submit();
    expect(close).toHaveBeenLastCalledWith({ hardwareId: 'VINE-A001' });
  });
  it('fails closed if a foreign/occupied cellar ID is injected into the form', () => {
    for (const id of ['foreign', 'occupied']) {
      fixture.componentInstance.form.patchValue({ hardwareId: 'VINE-A001', cellarId: id }); fixture.componentInstance.submit();
      expect(close).not.toHaveBeenCalled();
      expect(fixture.componentInstance.form.get('cellarId')?.hasError('unavailable')).toBe(true);
    }
  });
  it('keeps the hardware draft through a failed cellar load and retry', async () => {
    fixture.componentInstance.form.patchValue({ hardwareId: 'VINE-A001' });
    load.mockReturnValueOnce(throwError(() => new Error('offline')));
    fixture.componentInstance.loadCellars(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    fixture.componentInstance.loadCellars(); await fixture.whenStable();
    expect(fixture.componentInstance.cellarError()).toBe(false);
    expect(fixture.componentInstance.form.value.hardwareId).toBe('VINE-A001');
  });
  it('cancels pending cellar reads and closes the old-space modal when workspace changes', () => {
    const pending = new Subject<readonly WineCellar[]>(); load.mockReturnValueOnce(pending);
    fixture.componentInstance.loadCellars();
    TestBed.inject(WorkspaceScopeService).activate(null, true);
    expect(close).toHaveBeenCalledWith(undefined);
    pending.next([{ ...cellar, name: 'Stale result' }]);
    expect(fixture.componentInstance.cellars().some(item => item.name === 'Stale result')).toBe(false);
  });
  it('translates the selector without translating cellar names or losing selections', async () => {
    fixture.componentInstance.form.patchValue({ hardwareId: 'VINE-A001', cellarId: 'cellar-1' });
    TestBed.inject(I18nService).setLanguage('en'); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Cellar (optional)');
    expect(fixture.nativeElement.textContent).toContain('Not assigned to a cellar');
    expect(fixture.nativeElement.textContent).toContain('Mi colección');
    expect(fixture.componentInstance.form.value.cellarId).toBe('cellar-1');
  });
});
