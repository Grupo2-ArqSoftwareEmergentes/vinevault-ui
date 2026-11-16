import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CavasPageComponent } from './cavas-page.component';
import { WineCellarDialogComponent } from '../../components/wine-cellar-dialog/wine-cellar-dialog.component';
import { WineCellarQueryServiceImpl } from '../../../application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellarCommandServiceImpl } from '../../../application/internal/commandservices/wine-cellar-command-service.impl';
import { WineCellar } from '../../../domain/services/wine-cellar-query-service';
import { createWineCellarId } from '../../../domain/model/valueobjects/wine-cellar-id.value-object';
import { DEVICE_QUERY_SERVICE, Device, Space } from '../../../../device/domain/services/device-query-service';
import { DEVICE_COMMAND_SERVICE } from '../../../../device/domain/services/device-command-service';
import { ExternalTelemetryEvaluationService, DeviceTelemetrySnapshot } from '../../../../device/application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { createOrganizationId } from '../../../../device/domain/model/valueobjects/organization-id.value-object';
import { createUserId } from '../../../../device/domain/model/valueobjects/user-id.value-object';
import { createDeviceId } from '../../../../device/domain/model/valueobjects/device-id.value-object';
import { createHardwareId } from '../../../../device/domain/model/valueobjects/hardware-id.value-object';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { WorkspaceApiService } from '../../../../shared/services/workspace-api.service';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';

const space: Space = {
  ...ownerAccess,
  id: createSpaceId('space-1'), name: 'Reserva', organizationId: createOrganizationId('org-1'),
  ownerUserId: createUserId('user-1'), createdAt: null, updatedAt: null,
};
const device: Device = {
  id: createDeviceId('device-1'), name: 'Sensor 1', serialNumber: 'SN-0001', status: 'ONLINE',
  spaceId: space.id, ownerUserId: space.ownerUserId, configuration: {}, thresholds: [],
  hardwareId: createHardwareId('VINE-A001'), deviceType: 'SENSOR', activatedAt: null,
  lastSeenAt: null, createdAt: null, updatedAt: null,
};
const cellar: WineCellar = {
  id: createWineCellarId('cellar-1'), spaceId: space.id, name: 'Cava Reserva',
  description: 'Tintos de guarda', deviceId: device.id, createdAt: null, updatedAt: null,
};
const unlinkedCellar: WineCellar = { ...cellar, id: createWineCellarId('cellar-2'), name: 'Cava sin sensor', deviceId: null };
const telemetry: DeviceTelemetrySnapshot = {
  temperature: 14.5, humidity: 65.2, connectivityStatus: 'ONLINE', connectivitySignalStrength: null,
  uptime: 0, healthStatus: 0, lastUpdateMinutes: 0, network: null, location: null, occurredAt: null,
};

describe('Cavas workspace', () => {
  let fixture: ComponentFixture<CavasPageComponent>;
  const loadCellars = vi.fn(() => of([cellar, unlinkedCellar]));
  const loadTelemetry = vi.fn(() => of(telemetry));
  const deleteCellar = vi.fn(() => of(void 0));

  beforeEach(async () => {
    loadCellars.mockReset().mockReturnValue(of([cellar, unlinkedCellar]));
    loadTelemetry.mockReset().mockReturnValue(of(telemetry));
    deleteCellar.mockReset().mockReturnValue(of(void 0));
    await TestBed.configureTestingModule({
      imports: [CavasPageComponent],
      providers: [
        provideRouter([]),
        { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [], cellars: [] }) } },
        { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: loadCellars } },
        { provide: WineCellarCommandServiceImpl, useValue: { deleteWineCellar: deleteCellar } },
        { provide: ExternalTelemetryEvaluationService, useValue: { fetchLatestTelemetryByDevice: loadTelemetry } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: () => of([]) } },
        { provide: DEVICE_COMMAND_SERVICE, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CavasPageComponent);
    await fixture.whenStable();
    TestBed.inject(WorkspaceScopeService).activate(space);
    TestBed.inject(WorkspaceContextService).spaces.set([space]);
  });

  it('uses the shared destructive confirmation and deletes only when confirmed', () => {
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown>);
    fixture.componentInstance.deleteWineCellar(cellar);
    expect(deleteCellar).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ panelClass: 'destructive-confirmation-dialog' }));
    open.mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown>);
    fixture.componentInstance.deleteWineCellar(cellar);
    expect(deleteCellar).toHaveBeenCalledExactlyOnceWith('cellar-1');
  });

  it('loads the selected space and distinguishes linked cavas with their telemetry', async () => {
    fixture.componentInstance.selectSpace(space);
    await fixture.whenStable();
    expect(loadCellars).toHaveBeenCalledWith('space-1');
    expect(loadTelemetry).toHaveBeenCalledOnce();
    expect(loadTelemetry).toHaveBeenCalledWith('device-1');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Reserva');
    expect(element.querySelectorAll('.cava-card').length).toBe(2);
    expect(element.querySelector('.device-pill--linked')?.textContent?.trim()).toBe('Vinculado');
    expect(element.querySelector('.device-pill:not(.device-pill--linked)')?.textContent?.trim()).toBe('No vinculado');
    expect(element.querySelector('.device-metrics')?.textContent).toContain('Temp 14.5 °C | Humedad 65.2 %');
  });

  it('preserves selection and inventory routing with both identifiers', async () => {
    fixture.componentInstance.selectSpace(space);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector<HTMLButtonElement>('.cava-select')!;
    select.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedWineCellarId).toBe('cellar-1');
    expect(select.getAttribute('aria-expanded')).toBe('true');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    element.querySelector<HTMLButtonElement>('.cava-action--inventory')!.click();
    expect(navigate).toHaveBeenCalledWith(['/inventory'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
    expect(fixture.componentInstance.selectedWineCellarId).toBe('cellar-1');
  });

  it('opens the create modal from the add action without changing its space data', async () => {
    fixture.componentInstance.selectSpace(space);
    await fixture.whenStable();
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<WineCellarDialogComponent>);
    fixture.nativeElement.querySelector('[aria-label="Nueva cava"]').click();
    expect(open).toHaveBeenCalledWith(WineCellarDialogComponent, expect.objectContaining({
      panelClass: 'cava-management-dialog', data: { title: 'Crear cava', submitLabel: 'Crear', spaceId: 'space-1' },
    }));
  });

  it('keeps an empty space visible and explicit', async () => {
    loadCellars.mockReturnValue(of([]));
    fixture.componentInstance.selectSpace(space);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.state-row--empty').textContent).toContain('No hay cavas registradas');
  });

  it('immediately includes a cellar created from the global selector', async () => {
    const workspace = TestBed.inject(WorkspaceContextService);
    workspace.spaces.set([space]);
    workspace.adoptSpace(space);
    await fixture.whenStable();
    const created = { ...unlinkedCellar, id: createWineCellarId('cellar-3'), name: 'New cellar' };
    loadCellars.mockReturnValue(of([cellar, unlinkedCellar, created]));
    workspace.upsertCellar(created, true);
    await fixture.whenStable();
    expect(fixture.componentInstance.wineCellars.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('New cellar');
    expect(fixture.componentInstance.selectedWineCellarId).toBe('cellar-3');
  });
});

describe('Wine cellar create/edit modal', () => {
  let fixture: ComponentFixture<WineCellarDialogComponent>;
  const close = vi.fn();
  const loadDevices = vi.fn(() => of({ content: [device], totalElements: 1, totalPages: 1, number: 0, size: 100 }));

  beforeEach(async () => {
    close.mockReset();
    loadDevices.mockClear();
    await TestBed.configureTestingModule({
      imports: [WineCellarDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { title: 'Crear cava', submitLabel: 'Crear', spaceId: 'space-1' } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetDevicesBySpace: loadDevices } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WineCellarDialogComponent);
    await fixture.whenStable();
  });

  it('preserves required validation and the initial no-device selection', () => {
    expect(fixture.nativeElement.querySelector('.dialog-button--primary').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.device-options .selected').textContent).toContain('Sin dispositivo');
    expect(loadDevices).toHaveBeenCalledWith({ spaceId: space.id, page: 0, size: 100 });
    fixture.componentInstance.submit();
    expect(close).not.toHaveBeenCalled();
  });

  it('selects an IoT device and returns the unchanged trimmed form payload', async () => {
    fixture.componentInstance.form.controls.name.setValue(' Cava Reserva ');
    fixture.componentInstance.form.controls.description.setValue(' Tintos ');
    const radio = fixture.nativeElement.querySelectorAll('input[type="radio"]')[1] as HTMLInputElement;
    radio.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.form.controls.deviceId.value).toBe('device-1');
    expect(fixture.nativeElement.querySelector('.device-options .selected').textContent).toContain('SN-0001');
    fixture.nativeElement.querySelector('.dialog-button--primary').click();
    expect(close).toHaveBeenCalledWith({ name: 'Cava Reserva', description: 'Tintos', deviceId: 'device-1' });
  });

  it('supports creating without a sensor and cancels without a payload', async () => {
    fixture.componentInstance.form.controls.name.setValue('Cava sin sensor');
    await fixture.whenStable();
    fixture.componentInstance.submit();
    expect(close).toHaveBeenCalledWith({ name: 'Cava sin sensor', description: null, deviceId: null });
    close.mockClear();
    fixture.nativeElement.querySelector('.dialog-button:not(.dialog-button--primary)').click();
    expect(close).toHaveBeenCalledOnce();
    expect(close.mock.calls[0][0]).toBeUndefined();
  });
});
