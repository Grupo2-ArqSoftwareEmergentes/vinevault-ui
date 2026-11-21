import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Overview } from './overview';
import { DEVICE_QUERY_SERVICE, Device, DevicePage } from '../../../../device/domain/services/device-query-service';
import { GetDevicesBySpaceQuery } from '../../../../device/domain/model/queries/get-devices-by-space.query';
import { DeviceAlertQueryServiceImpl } from '../../../../alerts/application/internal/queryservices/device-alert-query-service.impl';
import { DeviceAlert } from '../../../../alerts/domain/services/device-alert-query-service';
import { ExternalTelemetryEvaluationService, DeviceTelemetrySnapshot } from '../../../../device/application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellar } from '../../../../cava/domain/services/wine-cellar-query-service';
import { WineInventoryItemQueryServiceImpl } from '../../../../inventory/application/internal/queryservices/wine-inventory-item-query-service.impl';
import { WineInventoryItem } from '../../../../inventory/domain/services/wine-inventory-item-query-service';
import { WorkspaceContextService, WorkspaceSelection } from '../../../../shared/services/workspace-context.service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { WorkspaceSpace } from '../../../../shared/models/workspace-context';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';
import { AssistantLauncherService } from '../../../../assistant/assistant-launcher.service';

const space: WorkspaceSpace = { ...ownerAccess, id: { value: 'space-1' }, name: 'Mi colección' };
const other: WorkspaceSpace = { ...space, id: { value: 'space-2' }, name: 'Mi negocio', spaceType: 'BUSINESS' };
const cellar: WineCellar = { id: { value: 'cellar-1' }, spaceId: space.id, name: 'Principal', deviceId: { value: 'device-1' }, description: null, createdAt: null, updatedAt: null };
const second: WineCellar = { ...cellar, id: { value: 'cellar-2' }, name: 'Reserva', deviceId: { value: 'device-2' } };
const otherCellar: WineCellar = { ...cellar, id: { value: 'cellar-3' }, spaceId: other.id, name: 'Almacén', deviceId: { value: 'device-3' } };
const item: WineInventoryItem = { id: { value: 'item-1' }, wineCellarId: cellar.id, name: 'Reserva', quantity: 3, purchasePrice: '10.25', createdAt: null, updatedAt: null };
const zero: WineInventoryItem = { ...item, id: { value: 'item-zero' }, quantity: 0, purchasePrice: null };
const secondItem = { ...item, id: { value: 'item-2' }, wineCellarId: second.id, quantity: 7, purchasePrice: '5.00' };
const otherItem = { ...item, id: { value: 'item-3' }, wineCellarId: otherCellar.id, quantity: 100 };
const device: Device = { id: { value: 'device-1' }, name: 'Sensor principal', spaceId: space.id, status: 'ONLINE', serialNumber: 'SN1', hardwareId: { value: 'HW1' }, ownerUserId: null, configuration: {}, thresholds: [], deviceType: 'SENSOR', activatedAt: null, lastSeenAt: null, createdAt: null, updatedAt: null };
const device2: Device = { ...device, id: { value: 'device-2' }, name: 'Sensor reserva' };
const device3: Device = { ...device, id: { value: 'device-3' }, spaceId: other.id };
const snapshot = (): DeviceTelemetrySnapshot => ({ occurredAt: new Date().toISOString(), temperature: 16, humidity: 65, connectivityStatus: 'ONLINE', connectivitySignalStrength: -50, uptime: 60, healthStatus: 1, lastUpdateMinutes: 0, network: null, location: null });
const alert = (d: Device): DeviceAlert => ({ id: `alert-${d.id.value}`, deviceId: d.id, spaceId: d.spaceId, assignmentId: null, metric: 'TEMPERATURE', thresholdMetric: 'TEMPERATURE', thresholdValue: '18', actualValue: '20', message: 'Temperatura por encima del umbral configurado', status: 'ACTIVE', occurredAt: new Date().toISOString(), resolvedAt: null, createdAt: '', updatedAt: '' });

describe('Contextual Overview command center', () => {
  let fixture: ComponentFixture<Overview>;
  let component: Overview;
  let changes: BehaviorSubject<WorkspaceSelection>;
  let selection: ReturnType<typeof signal<WorkspaceSelection>>;
  const loadOrganizations = vi.fn();
  const loadDevices = vi.fn<(query: GetDevicesBySpaceQuery) => Observable<DevicePage>>();
  const loadCellars = vi.fn<(id: string) => Observable<readonly WineCellar[]>>();
  const loadItems = vi.fn<(id: string) => Observable<readonly WineInventoryItem[]>>();
  const loadTelemetry = vi.fn<(id: string) => Observable<DeviceTelemetrySnapshot | null>>();
  const loadAlerts = vi.fn();
  const select = (s: WorkspaceSpace | null, c: WineCellar | null) => {
    TestBed.inject(WorkspaceScopeService).activate(s);
    selection.set({ space: s, cellar: c });
    changes.next(selection());
  };

  beforeEach(async () => {
    selection = signal<WorkspaceSelection>({ space, cellar });
    changes = new BehaviorSubject(selection());
    loadOrganizations.mockReset();
    loadDevices.mockReset().mockImplementation(query => of({ content: query.spaceId.value === space.id.value ? [device, device2] : [device3], totalElements: 2, totalPages: 1, size: 100, number: 0 }));
    loadCellars.mockReset().mockImplementation(id => of(id === space.id.value ? [cellar, second] : [otherCellar]));
    loadItems.mockReset().mockImplementation(id => of(id === cellar.id.value ? [item, zero] : id === second.id.value ? [secondItem] : [otherItem]));
    loadTelemetry.mockReset().mockImplementation(() => of(snapshot()));
    loadAlerts.mockReset().mockImplementation((query: { deviceId: { value: string } }) => { const d = query.deviceId.value === device.id.value ? device : query.deviceId.value === device2.id.value ? device2 : device3; return of([alert(d), { ...alert(d), id: 'resolved', status: 'RESOLVED' }]); });
    await TestBed.configureTestingModule({ imports: [Overview], providers: [
      provideRouter([]),
      { provide: WorkspaceContextService, useValue: { selection, selectionChanges: changes.asObservable(), spaces: signal([space, other]), cellars: signal([cellar, second, otherCellar]), accountQuota: signal(undefined), loading: signal(false), error: signal(''), ensureLoaded: vi.fn(), refresh: vi.fn() } },
      { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetDevicesBySpace: loadDevices, handleGetCurrentUserOrganizations: loadOrganizations } },
      { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: loadCellars } },
      { provide: WineInventoryItemQueryServiceImpl, useValue: { getInventoryItemsByWineCellar: loadItems } },
      { provide: ExternalTelemetryEvaluationService, useValue: { fetchLatestTelemetryByDevice: loadTelemetry } },
      { provide: DeviceAlertQueryServiceImpl, useValue: { handleGetDeviceAlertsByDevice: loadAlerts } },
    ] }).compileComponents();
    TestBed.inject(WorkspaceScopeService).activate(space);
    fixture = TestBed.createComponent(Overview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows exactly four contextual KPIs and two actionable panels, without administrative or duplicated metrics', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Mi colección');
    expect(element.querySelector('.scope-label')?.textContent).toBe('Principal');
    expect(element.querySelector('.eyebrow')?.textContent).toContain('COLECCIÓN');
    expect(element.querySelectorAll('.summary-card')).toHaveLength(4);
    expect(component.summaryCards.map(card => card.label)).toEqual(['Botellas en stock', 'Referencias / SKUs', 'Alertas activas', 'Sensores en línea']);
    expect(component.summaryCards.map(card => card.value)).toEqual(['3', '2', '1', '1']);
    expect(element.querySelectorAll('.details-grid > .panel-card')).toHaveLength(2);
    expect(element.querySelector('.status-row, .status-list')).toBeNull();
    for (const text of ['Organizations', 'Spaces', 'Operational snapshot', 'Rows loaded', 'Real data from']) expect(element.textContent).not.toContain(text);
    expect(loadOrganizations).not.toHaveBeenCalled();
    expect(loadItems).toHaveBeenCalledExactlyOnceWith('cellar-1');
    expect(loadTelemetry).toHaveBeenCalledExactlyOnceWith('device-1');
    expect(component.costValue).toBe('30.75');
  });

  it('aggregates only cellars in the selected space when no cellar is selected', () => {
    loadItems.mockClear();
    select(space, null);
    expect(component.scopeLabel).toBe('Todas las cavas del espacio');
    expect(component.summaryCards.map(card => card.value)).toEqual(['10', '3', '2', '2']);
    expect(component.costValue).toBe('65.75');
    expect(loadItems.mock.calls.map(call => call[0])).toEqual(['cellar-1', 'cellar-2']);
    expect(loadItems).not.toHaveBeenCalledWith('cellar-3');
  });

  it('counts configured low-stock warnings in Business and keeps Collector references including duplicate names and zero stock', async () => {
    const business = { ...space, spaceType: 'BUSINESS' as const };
    loadItems.mockReturnValueOnce(of([{ ...item, minStockAlert: 5 }, zero]));
    select(business, cellar);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.eyebrow').textContent).toContain('NEGOCIO');
    expect(component.summaryCards[1].value).toBe('2');
    expect(component.summaryCards[2].value).toBe('2');
    expect(component.activityItems.some(activity => activity.title.includes('Stock bajo'))).toBe(true);
    expect(component.cellarState).toBe('Requiere atención');
    expect(fixture.nativeElement.querySelector('.cost-label').textContent).toBe('Costo de inventario');
  });

  it('links KPIs and quick actions with the selected context, and opens the existing assistant without querying AI', async () => {
    const links = fixture.nativeElement.querySelectorAll('.summary-card') as NodeListOf<HTMLAnchorElement>;
    expect(links[2].getAttribute('href')).toBe('/alerts?spaceId=space-1&wineCellarId=cellar-1');
    expect(links[3].getAttribute('href')).toBe('/devices?spaceId=space-1&wineCellarId=cellar-1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('.primary-action').click();
    expect(navigate).toHaveBeenCalledWith(['/inventory/new'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
    fixture.nativeElement.querySelector('.open-assistant').click();
    expect(TestBed.inject(AssistantLauncherService).isOpen()).toBe(true);
    await fixture.whenStable();
  });

  it('does not expose Add wine for read-only roles or navigate without a selected cellar', async () => {
    select({ ...space, role: 'WAITER' }, cellar);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.primary-action')).toBeNull();
    select(space, null);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.primary-action').disabled).toBe(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    component.addWine();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows a clean activity empty state with useful links instead of inventing events or inventory value', async () => {
    loadItems.mockReturnValueOnce(of([]));
    loadAlerts.mockReturnValueOnce(of([]));
    loadTelemetry.mockReturnValueOnce(of(null));
    component.refreshOverview();
    await fixture.whenStable();
    expect(component.summaryCards.map(card => card.value)).toEqual(['0', '0', '0', '0']);
    expect(component.costValue).toBeNull();
    const empty = fixture.nativeElement.querySelector('.empty-feed') as HTMLElement;
    expect(empty.textContent).toContain('Sin actividad reciente');
    expect(empty.querySelectorAll('a')).toHaveLength(2);
    expect(component.cellarState).toBe('Inventario por completar');
  });

  it('counts only ONLINE sensors with recent telemetry, not stale or unlinked devices', () => {
    loadTelemetry.mockReturnValueOnce(of({ ...snapshot(), occurredAt: '2000-01-01T00:00:00Z' }));
    component.refreshOverview();
    expect(component.summaryCards[3].value).toBe('0');
    loadCellars.mockReturnValueOnce(of([{ ...cellar, deviceId: null }, second]));
    component.refreshOverview();
    expect(component.summaryCards[3].value).toBe('0');
    expect(component.cellarState).toBe('Sin monitorización vinculada');
  });

  it('reads all device pages for a whole-space view, rather than silently truncating at 100', () => {
    loadDevices.mockImplementation(query => of({ content: query.page ? [device2] : [device], totalPages: 2, totalElements: 2, number: query.page, size: 1 }));
    select(space, null);
    expect(loadDevices).toHaveBeenCalledWith(expect.objectContaining({ spaceId: space.id, page: 1 }));
    expect(component.summaryCards[3].value).toBe('2');
  });

  it('blocks duplicate refreshes while pending and announces the last synchronization', async () => {
    const pending = new Subject<readonly WineInventoryItem[]>();
    loadItems.mockReturnValueOnce(pending);
    const before = loadItems.mock.calls.length;
    const refresh = fixture.nativeElement.querySelector('.refresh-button') as HTMLButtonElement;
    refresh.click();
    component.refreshOverview();
    await fixture.whenStable();
    expect(loadItems).toHaveBeenCalledTimes(before + 1);
    expect(refresh.disabled).toBe(true);
    expect(component.summaryCards[0].value).toBe('—');
    pending.next([item]);
    pending.complete();
    await fixture.whenStable();
    expect(refresh.disabled).toBe(false);
    expect(component.refreshedLabel).toContain('Última sincronización');
  });

  it('cancels old loads when switching spaces and never populates another context with a late response', () => {
    const pending = new Subject<readonly WineInventoryItem[]>();
    loadItems.mockReturnValueOnce(pending);
    component.refreshOverview();
    select(other, otherCellar);
    expect(component.summaryCards[0].value).toBe('100');
    pending.next([{ ...item, quantity: 999 }]);
    pending.complete();
    expect(component.summaryCards[0].value).toBe('100');
    expect(component.loading).toBe(false);
  });

  it('distinguishes unavailable inventory from a real zero and permits a deliberate refresh', async () => {
    loadItems.mockReturnValueOnce(throwError(() => new Error('Unavailable')));
    component.refreshOverview();
    await fixture.whenStable();
    expect(component.summaryCards[0].value).toBe('—');
    expect(component.summaryCards[1].value).toBe('—');
    expect(component.costValue).toBeNull();
    expect(component.cellarState).toBe('Datos parciales');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('inventario');
    component.refreshOverview();
    expect(component.summaryCards[0].value).toBe('3');
    expect(component.error).toBe('');
  });

  it('shows unknown active-alert totals when that source fails instead of declaring the cava healthy', () => {
    loadAlerts.mockReturnValueOnce(throwError(() => new Error('Unavailable')));
    component.refreshOverview();
    expect(component.summaryCards[2].value).toBe('—');
    expect(component.cellarState).toBe('Datos parciales');
    expect(component.stateTone).not.toBe('success');
  });

  it('clears previous context data when no space remains and performs no cross-space discovery', async () => {
    select(null, null);
    await fixture.whenStable();
    expect(component.summaryCards.every(card => card.value === '—')).toBe(true);
    expect(component.costValue).toBeNull();
    expect(component.activityItems).toEqual([]);
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Selecciona un espacio');
    expect(loadOrganizations).not.toHaveBeenCalled();
  });

  it('preserves sidebar expansion and dismissal behavior', async () => {
    const toggle = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    const initial = component.isSidebarOpen;
    toggle.click();
    await fixture.whenStable();
    expect(component.isSidebarOpen).toBe(!initial);
    if (!component.isSidebarOpen) { toggle.click(); await fixture.whenStable(); }
    fixture.nativeElement.querySelector('.sidebar-backdrop').click();
    await fixture.whenStable();
    expect(component.isSidebarOpen).toBe(false);
  });
});
