import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SpaceDevicesPageComponent } from './space-devices-page.component';
import { SpaceDevicesPageActionsService } from './space-devices-page-actions.service';
import { HydratedDeviceSelection, SpaceDevicesSelectionHydrationService } from './space-devices-selection-hydration.service';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { WorkspaceApiService } from '../../../../shared/services/workspace-api.service';
import { DEVICE_QUERY_SERVICE, Device, DevicePage, Organization, Space } from '../../../domain/services/device-query-service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellar } from '../../../../cava/domain/services/wine-cellar-query-service';
import { createOrganizationId } from '../../../domain/model/valueobjects/organization-id.value-object';
import { createSpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { createUserId } from '../../../domain/model/valueobjects/user-id.value-object';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { createHardwareId } from '../../../domain/model/valueobjects/hardware-id.value-object';
import { createWineCellarId } from '../../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';

const organization: Organization = { id: createOrganizationId('org-1'), name: 'Estate', ownerUserId: createUserId('user-1'), createdAt: null, updatedAt: null };
const space: Space = { ...ownerAccess, id: createSpaceId('space-1'), name: 'North', organizationId: organization.id, ownerUserId: organization.ownerUserId, createdAt: null, updatedAt: null };
const other: Space = { ...space, id: createSpaceId('space-2'), name: 'South' };
const device: Device = { id: createDeviceId('device-1'), name: 'Sensor', serialNumber: 'SN-1', status: 'ONLINE', spaceId: space.id, ownerUserId: organization.ownerUserId, configuration: {}, thresholds: [], hardwareId: createHardwareId('VINE-A001'), deviceType: 'SENSOR', activatedAt: null, lastSeenAt: null, createdAt: null, updatedAt: null };
const cellar: WineCellar = { id: createWineCellarId('cellar-1'), name: 'Reserve', description: null, spaceId: space.id, deviceId: device.id, createdAt: null, updatedAt: null };
const page: DevicePage = { content: [device], totalElements: 1, totalPages: 1, number: 0, size: 50 };

describe('Devices global workspace integration', () => {
  let fixture: ComponentFixture<SpaceDevicesPageComponent>;
  const loadDevices = vi.fn(() => of(page));
  const loadCellarDevice = vi.fn(() => of(page));
  const hydrate = vi.fn(() => of<HydratedDeviceSelection | null>({ device, space }));
  const deleteSpace = vi.fn(() => of(false));
  const claimDevice = vi.fn(() => of(true));

  beforeEach(async () => {
    loadDevices.mockReset().mockReturnValue(of(page));
    loadCellarDevice.mockReset().mockReturnValue(of(page));
    hydrate.mockReset().mockReturnValue(of({ device, space }));
    deleteSpace.mockReset().mockReturnValue(of(false));
    claimDevice.mockReset().mockReturnValue(of(true));
    await TestBed.configureTestingModule({
      imports: [SpaceDevicesPageComponent],
      providers: [
        provideRouter([{ path: 'devices', component: SpaceDevicesPageComponent }]),
        { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [space, other], cellars: [cellar] }) } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: () => of([organization]), handleGetSpacesByOrganization: () => of([space, other]) } },
        { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: (id: string) => of(id === 'space-1' ? [cellar] : []) } },
        { provide: SpaceDevicesSelectionHydrationService, useValue: { hydrateFromDeviceId: hydrate } },
        { provide: SpaceDevicesPageActionsService, useValue: {
          loadDevices, loadCellarDevice, runDeleteSpaceFlow: deleteSpace, runClaimDeviceFlow: claimDevice,
          watchLatestTelemetryByDevices: () => of({}), watchLatestTelemetry: () => of(null), watchDeviceStatus: () => of(null),
        } },
      ],
    }).compileComponents();
  });

  async function start(url = '/devices') {
    await TestBed.inject(Router).navigateByUrl(url);
    fixture = TestBed.createComponent(SpaceDevicesPageComponent);
    await fixture.whenStable();
    if (url === '/devices') {
      TestBed.inject(WorkspaceContextService).chooseSpace('space-1', false);
      await fixture.whenStable();
    }
    return TestBed.inject(WorkspaceContextService);
  }

  it('lists every sensor in the space even with a cellar selected, including unlinked sensors', async () => {
    const context = await start();
    expect(fixture.nativeElement.querySelector('app-organizations-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-workspace-switcher')).toBeTruthy();
    context.chooseCellar('cellar-1', false);
    await fixture.whenStable();
    expect(loadCellarDevice).not.toHaveBeenCalled();
    expect(loadDevices).toHaveBeenLastCalledWith(space.id, 0, 100);
    expect(fixture.componentInstance.devicesPage?.content).toEqual([device]);
    context.chooseSpace('space-2', false);
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedSpace?.id.value).toBe('space-2');
    expect(loadDevices).toHaveBeenLastCalledWith(other.id, 0, 100);
  });

  it('preserves deviceId deep links, then exits device detail when the workspace changes', async () => {
    const context = await start('/devices?deviceId=device-1');
    expect(hydrate).toHaveBeenCalledWith('device-1');
    expect(fixture.componentInstance.selectedDevice?.id.value).toBe('device-1');
    expect(context.selection().space?.id.value).toBe('space-1');
    context.chooseSpace('space-2');
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedDevice).toBeNull();
    expect(fixture.componentInstance.selectedSpace?.id.value).toBe('space-2');
    expect(TestBed.inject(Router).url).not.toContain('deviceId');
  });

  it('cancels stale device hydration when the user switches workspace', async () => {
    const pending = new Subject<HydratedDeviceSelection | null>();
    hydrate.mockReturnValueOnce(pending);
    const context = await start('/devices?deviceId=device-1');
    context.chooseSpace('space-2');
    await fixture.whenStable();
    pending.next({ device, space });
    pending.complete();
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedSpace?.id.value).toBe('space-2');
    expect(fixture.componentInstance.selectedDevice).toBeNull();
  });

  it('does not replace the new device list with an earlier space response', async () => {
    const pending = new Subject<DevicePage>();
    loadDevices.mockReturnValue(pending);
    const context = await start();
    loadDevices.mockReturnValue(of({ ...page, content: [], totalElements: 0 }));
    context.chooseSpace('space-2', false);
    await fixture.whenStable();
    pending.next(page);
    pending.complete();
    expect(fixture.componentInstance.devicesPage?.content.length).toBe(0);
  });

  it('refreshes once after a successful claim and immediately renders grid and list without linking a cellar', async () => {
    loadDevices.mockReturnValue(of({ ...page, content: [], totalElements: 0 }));
    const context = await start();
    context.chooseCellar('cellar-1', false); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No hay dispositivos registrados');
    const pending = new Subject<boolean>(); claimDevice.mockReturnValue(pending);
    loadDevices.mockClear();
    fixture.componentInstance.openClaimDeviceDialog(); fixture.componentInstance.openClaimDeviceDialog();
    expect(claimDevice).toHaveBeenCalledOnce();
    expect(loadDevices).not.toHaveBeenCalled();
    loadDevices.mockReturnValue(of(page)); pending.next(true); pending.complete();
    await fixture.whenStable();
    expect(loadDevices).toHaveBeenCalledExactlyOnceWith(space.id, 0, 100);
    expect(loadCellarDevice).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.device-card')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('SN-1');
    expect(fixture.nativeElement.textContent).not.toContain('No hay dispositivos registrados');
    fixture.componentInstance.setViewMode('list'); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.device-list-item')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('SN-1');
    // A fresh component must use GET by space too, not the linked cellar cache.
    fixture.destroy(); fixture = TestBed.createComponent(SpaceDevicesPageComponent); await fixture.whenStable();
    expect(fixture.componentInstance.devicesPage?.content).toEqual([device]);
    expect(fixture.nativeElement.querySelector('.device-card')).toBeTruthy();
  });

  it('does not refetch after a cancelled/failed claim or overwrite the newly selected space', async () => {
    const context = await start();
    claimDevice.mockReturnValueOnce(of(false)); loadDevices.mockClear();
    fixture.componentInstance.openClaimDeviceDialog();
    expect(loadDevices).not.toHaveBeenCalled();
    const pending = new Subject<boolean>(); claimDevice.mockReturnValueOnce(pending);
    fixture.componentInstance.openClaimDeviceDialog(); context.chooseSpace('space-2', false);
    await fixture.whenStable(); loadDevices.mockClear(); pending.next(true); pending.complete();
    expect(loadDevices).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedSpace?.id.value).toBe('space-2');
  });

  it('shows a load error, not a false empty list, if the post-claim GET fails and allows another attempt', async () => {
    await start();
    loadDevices.mockReturnValueOnce(throwError(() => new Error('offline')));
    fixture.componentInstance.openClaimDeviceDialog(); await fixture.whenStable();
    expect(fixture.componentInstance.loadingDevices).toBe(false);
    expect(fixture.componentInstance.errorDevices).toBe('Failed to load devices');
    expect(fixture.nativeElement.textContent).not.toContain('No hay dispositivos registrados');
    fixture.componentInstance.openClaimDeviceDialog(); await fixture.whenStable();
    expect(claimDevice).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.devicesPage?.content).toEqual([device]);
  });

  it('waits for deletion success before updating the selector and blocks repeated attempts', async () => {
    const context = await start();
    const pending = new Subject<boolean>();
    deleteSpace.mockReturnValueOnce(pending);
    const remove = vi.spyOn(context, 'removeSpace');
    fixture.componentInstance.openDeleteSpaceDialog();
    fixture.componentInstance.openDeleteSpaceDialog();
    expect(deleteSpace).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    expect(context.selection().space?.id.value).toBe('space-1');
    // Reflect the successful deletion in the authoritative refresh response.
    vi.spyOn(TestBed.inject(WorkspaceApiService), 'getContext').mockReturnValue(of({ spaces: [other], cellars: [] }));
    pending.next(true);
    pending.complete();
    expect(remove).toHaveBeenCalledExactlyOnceWith('space-1');
    expect(context.selection().space?.id.value).toBe('space-2');
  });

  it('keeps the selector unchanged when deletion is cancelled or fails', async () => {
    const context = await start();
    const remove = vi.spyOn(context, 'removeSpace');
    fixture.componentInstance.openDeleteSpaceDialog();
    expect(remove).not.toHaveBeenCalled();
    expect(context.selection().space?.id.value).toBe('space-1');
    fixture.componentInstance.openDeleteSpaceDialog();
    expect(deleteSpace).toHaveBeenCalledTimes(2);
  });
});
