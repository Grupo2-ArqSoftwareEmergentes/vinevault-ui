import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NotificationService } from '../../../../core/services/notification/notification';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SpaceDevicesPageActionsService } from './space-devices-page-actions.service';
import { DEVICE_COMMAND_SERVICE } from '../../../domain/services/device-command-service';
import { DEVICE_QUERY_SERVICE } from '../../../domain/services/device-query-service';
import { DEVICE_STATUS_QUERY_SERVICE } from '../../../domain/services/device-status-query-service';
import { DEVICE_THRESHOLD_QUERY_SERVICE } from '../../../domain/services/device-threshold-query-service';
import { DeviceCommandServiceImpl } from '../../../application/internal/commandservices/device-command-service.impl';
import { ExternalTelemetryEvaluationService } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { DeleteSpaceDialogComponent } from '../../components/delete-space-dialog/delete-space-dialog.component';
import { createSpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { API_CONFIG } from '../../../../api.config';
import { DeviceQueryServiceImpl } from '../../../application/internal/queryservices/device-query-service.impl';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';

describe('Space cascade deletion confirmation and HTTP contract', () => {
  let closed: Subject<boolean>;
  let http: HttpTestingController;
  const open = vi.fn();
  const notify = vi.fn();

  beforeEach(() => {
    closed = new Subject<boolean>();
    open.mockReset().mockReturnValue({ afterClosed: () => closed });
    notify.mockReset();
    TestBed.configureTestingModule({
      imports: [DeleteSpaceDialogComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: DEVICE_COMMAND_SERVICE, useClass: DeviceCommandServiceImpl },
        ...[DEVICE_QUERY_SERVICE, DEVICE_STATUS_QUERY_SERVICE, DEVICE_THRESHOLD_QUERY_SERVICE, ExternalTelemetryEvaluationService].map((provide) => ({ provide, useValue: {} })),
        { provide: MatDialog, useValue: { open } },
        { provide: MatDialogRef, useValue: { close: vi.fn(), addPanelClass: vi.fn() } },
        { provide: NotificationService, useValue: { show: notify } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('warns explicitly that cellars and inventory are permanently deleted', () => {
    const fixture = TestBed.createComponent(DeleteSpaceDialogComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todas sus cavas, inventario e historial de movimientos también se eliminarán de forma permanente');
    expect(fixture.nativeElement.textContent).toContain('no se puede deshacer');
  });

  it('sends one DELETE only after confirmation and reports success after 204', () => {
    const result = vi.fn();
    TestBed.inject(SpaceDevicesPageActionsService).runDeleteSpaceFlow(createSpaceId('space-1')).subscribe(result);
    expect(open).toHaveBeenCalledWith(DeleteSpaceDialogComponent, expect.objectContaining({
      panelClass: 'destructive-confirmation-dialog', backdropClass: 'destructive-confirmation-backdrop',
      autoFocus: '.destructive-cancel', role: 'alertdialog',
    }));
    http.expectNone((req) => req.method === 'DELETE');
    closed.next(true);
    closed.next(true);
    const request = http.expectOne(`${API_CONFIG.baseUrl}/api/v1/spaces/space-1`);
    expect(request.request.method).toBe('DELETE');
    expect(result).not.toHaveBeenCalled();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(result).toHaveBeenCalledExactlyOnceWith(true);
    http.expectNone((req) => req.method === 'DELETE');
  });

  it('does not delete when confirmation is cancelled', () => {
    const result = vi.fn();
    TestBed.inject(SpaceDevicesPageActionsService).runDeleteSpaceFlow(createSpaceId('space-1')).subscribe(result);
    closed.next(false);
    expect(result).toHaveBeenCalledWith(false);
    http.expectNone((req) => req.method === 'DELETE');
  });

  it('reports failure without success or automatic retry', () => {
    const result = vi.fn();
    TestBed.inject(SpaceDevicesPageActionsService).runDeleteSpaceFlow(createSpaceId('space-1')).subscribe(result);
    closed.next(true);
    http.expectOne(`${API_CONFIG.baseUrl}/api/v1/spaces/space-1`).flush({}, { status: 500, statusText: 'Server Error' });
    expect(result).toHaveBeenCalledExactlyOnceWith(false);
    expect(notify).toHaveBeenCalledWith('Failed to delete space', 'error', 3000);
    http.expectNone((req) => req.method === 'DELETE');
  });
});

describe('Device pairing, claiming and space list HTTP contract', () => {
  const space = { ...ownerAccess, id: createSpaceId('space-1'), name: 'Coleccion2' };
  const resource = { id: 'device-1', serial_number: 'SN-0001', name: 'Sensor 0001', status: 'OFFLINE', space_id: 'space-1', owner_user_id: 1, configuration: {}, thresholds: [], hardware_id: 'VINE-A001', device_type: 'air-quality-v1', activated_at: null, last_seen_at: null, created_at: null, updated_at: null };
  let closed: Subject<{ hardwareId: string } | undefined>;
  let http: HttpTestingController;
  let service: SpaceDevicesPageActionsService;
  const notify = vi.fn();
  beforeEach(() => {
    closed = new Subject(); notify.mockReset();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: DEVICE_COMMAND_SERVICE, useClass: DeviceCommandServiceImpl },
      { provide: DEVICE_QUERY_SERVICE, useClass: DeviceQueryServiceImpl },
      ...[DEVICE_STATUS_QUERY_SERVICE, DEVICE_THRESHOLD_QUERY_SERVICE, ExternalTelemetryEvaluationService].map(provide => ({ provide, useValue: {} })),
      { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => closed }) } },
      { provide: NotificationService, useValue: { show: notify } },
    ] });
    service = TestBed.inject(SpaceDevicesPageActionsService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('pairs then claims exactly once and lists the snake_case response by the same space without status/cellar filters', () => {
    const result = vi.fn(); service.runClaimDeviceFlow(space).subscribe(result);
    closed.next({ hardwareId: 'VINE-A001' }); closed.next({ hardwareId: 'VINE-A001' });
    const pair = http.expectOne(`${API_CONFIG.baseUrl}/api/v1/devices/pair`);
    expect(pair.request.body).toEqual({ hardware_id: 'VINE-A001' });
    expect(notify).not.toHaveBeenCalled();
    pair.flush({ device_id: resource.id, claim_token: 'token-1' });
    const claim = http.expectOne(`${API_CONFIG.baseUrl}/api/v1/devices/claim`);
    expect(claim.request.body).toEqual({ claim_token: 'token-1', space_id: 'space-1' });
    expect(result).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
    claim.flush(resource);
    expect(result).toHaveBeenCalledExactlyOnceWith(true);
    expect(notify).toHaveBeenCalledExactlyOnceWith('Sensor registered to space', 'success', 3000);
    const listed = vi.fn(); service.loadDevices(space.id, 0, 100).subscribe(listed);
    const list = http.expectOne(req => req.method === 'GET' && req.url.endsWith('/devices'));
    expect(list.request.params.keys().sort()).toEqual(['page', 'size', 'space_id']);
    expect(list.request.params.get('space_id')).toBe('space-1');
    list.flush({ items: [resource], total: 1, page: 0, size: 100 });
    expect(listed.mock.calls[0][0].content[0]).toEqual(expect.objectContaining({ id: { value: 'device-1' }, spaceId: { value: 'space-1' }, status: 'OFFLINE', serialNumber: 'SN-0001' }));
  });

  for (const failure of ['cancel', 'no-token', 'pair-error', 'claim-error']) it(`does not report success or retry on ${failure}`, () => {
    const result = vi.fn(); service.runClaimDeviceFlow(space).subscribe(result);
    closed.next(failure === 'cancel' ? undefined : { hardwareId: 'VINE-A001' });
    if (failure !== 'cancel') {
      const pair = http.expectOne(`${API_CONFIG.baseUrl}/api/v1/devices/pair`);
      if (failure === 'pair-error') pair.flush({}, { status: 409, statusText: 'Conflict' });
      else {
        pair.flush({ device_id: 'device-1', claim_token: failure === 'no-token' ? null : 'token-1' });
        if (failure === 'claim-error') http.expectOne(`${API_CONFIG.baseUrl}/api/v1/devices/claim`).flush({}, { status: 500, statusText: 'Error' });
      }
    }
    expect(result).toHaveBeenCalledExactlyOnceWith(false);
    expect(notify.mock.calls.some(call => call[1] === 'success')).toBe(false);
    http.expectNone(req => req.method === 'POST');
  });

  it('cancels a modal started in the old space before any mutation when the space changes', () => {
    const result = vi.fn(); service.runClaimDeviceFlow(space).subscribe(result);
    TestBed.inject(WorkspaceScopeService).activate({ ...space, id: createSpaceId('space-2') });
    closed.next({ hardwareId: 'VINE-A001' });
    expect(result).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
    http.expectNone(req => req.method === 'POST');
  });

  it('does not continue to claim or retry a cancelled pairing after authorization changes', () => {
    const result = vi.fn(); service.runClaimDeviceFlow(space).subscribe(result);
    closed.next({ hardwareId: 'VINE-A001' });
    const pair = http.expectOne(`${API_CONFIG.baseUrl}/api/v1/devices/pair`);
    TestBed.inject(WorkspaceScopeService).activate(null, true);
    expect(pair.cancelled).toBe(true); expect(result).not.toHaveBeenCalled();
    http.expectNone(req => req.url.endsWith('/devices/claim'));
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps automatic status polling alive after a transient error and cancels its interval on unsubscribe', () => {
    vi.useFakeTimers();
    try {
      const query = vi.fn().mockReturnValueOnce(throwError(() => new Error('offline'))).mockReturnValue(of({ deviceId: { value: 'device-1' }, status: 'ONLINE', isOnline: true, lastSeenAt: null }));
      TestBed.inject(DEVICE_STATUS_QUERY_SERVICE).handleGetDeviceStatusById = query;
      const result = vi.fn(); const subscription = service.watchDeviceStatus('device-1', 60_000).subscribe(result);
      expect(result).toHaveBeenCalledWith(null);
      vi.advanceTimersByTime(60_000);
      expect(query).toHaveBeenCalledTimes(2);
      expect(result.mock.calls.at(-1)?.[0].isOnline).toBe(true);
      subscription.unsubscribe(); vi.advanceTimersByTime(60_000);
      expect(query).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
});
