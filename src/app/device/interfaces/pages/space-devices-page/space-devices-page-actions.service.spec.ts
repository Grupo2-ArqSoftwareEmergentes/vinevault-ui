import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
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
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: notify } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('warns explicitly that cellars and inventory are permanently deleted', () => {
    const fixture = TestBed.createComponent(DeleteSpaceDialogComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('All its cellars and their inventory will also be permanently deleted');
    expect(fixture.nativeElement.textContent).toContain('cannot be undone');
  });

  it('sends one DELETE only after confirmation and reports success after 204', () => {
    const result = vi.fn();
    TestBed.inject(SpaceDevicesPageActionsService).runDeleteSpaceFlow(createSpaceId('space-1')).subscribe(result);
    expect(open).toHaveBeenCalledWith(DeleteSpaceDialogComponent, { width: '400px' });
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
    expect(notify).toHaveBeenCalledWith('Failed to delete space', 'Close', { duration: 3000 });
    http.expectNone((req) => req.method === 'DELETE');
  });
});
