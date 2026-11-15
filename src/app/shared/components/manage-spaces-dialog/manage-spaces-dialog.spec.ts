import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ManageSpacesDialogComponent } from './manage-spaces-dialog';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { DEVICE_COMMAND_SERVICE } from '../../../device/domain/services/device-command-service';
import { DeviceCommandServiceImpl } from '../../../device/application/internal/commandservices/device-command-service.impl';
import { DeleteSpaceDialogComponent } from '../../../device/interfaces/components/delete-space-dialog/delete-space-dialog.component';
import { API_CONFIG } from '../../../api.config';

const directory = {
  spaces: [{ id: 'space-1', name: 'North' }, { id: 'space-2', name: 'South' }],
  wine_cellars: [{ id: 'cellar-1', name: 'Reserve', space_id: 'space-1' }],
};
const base = API_CONFIG.baseUrl;

describe('Manage Spaces dialog', () => {
  let fixture: ComponentFixture<ManageSpacesDialogComponent>;
  let http: HttpTestingController;
  let workspace: WorkspaceContextService;
  const close = vi.fn();

  beforeEach(async () => {
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [ManageSpacesDialogComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: DEVICE_COMMAND_SERVICE, useClass: DeviceCommandServiceImpl },
        { provide: MatDialogRef, useValue: { close, disableClose: false } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    http.expectOne(`${base}/api/v1/user/context`).flush(directory);
    workspace.chooseCellar('cellar-1', false);
    fixture = TestBed.createComponent(ManageSpacesDialogComponent);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('lists spaces, cancels editing without requests, and closes normally', async () => {
    expect(fixture.nativeElement.querySelectorAll('.space-row').length).toBe(2);
    fixture.nativeElement.querySelector('[aria-label="Rename North"]').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').value).toBe('North');
    fixture.nativeElement.querySelector('.rename-form button[type="button"]').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    fixture.nativeElement.querySelector('mat-dialog-actions button').click();
    expect(close).toHaveBeenCalledOnce();
    http.expectNone((req) => req.method === 'PATCH' || req.method === 'DELETE');
  });

  it('renames with a trimmed name and updates the shared selector only after success', async () => {
    const space = workspace.spaces()[0];
    fixture.componentInstance.edit(space);
    fixture.componentInstance.name = '  Home  ';
    fixture.componentInstance.rename(space);
    fixture.componentInstance.rename(space);
    const patch = http.expectOne(`${base}/api/v1/spaces/space-1/name`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ name: 'Home' });
    expect(workspace.selection().space?.name).toBe('North');
    expect(fixture.componentInstance.dialogRef.disableClose).toBe(true);
    patch.flush(null, { status: 204, statusText: 'No Content' });
    expect(workspace.selection().space?.name).toBe('Home');
    http.expectOne(`${base}/api/v1/user/context`).flush({ ...directory, spaces: [{ id: 'space-1', name: 'Home' }, directory.spaces[1]] });
    await fixture.whenStable();
    expect(fixture.componentInstance.pendingId).toBeNull();
    expect(fixture.componentInstance.dialogRef.disableClose).toBe(false);
    expect(fixture.componentInstance.editingId).toBeNull();
  });

  it('rejects blank names without sending a request', () => {
    const space = workspace.spaces()[0];
    fixture.componentInstance.edit(space);
    fixture.componentInstance.name = '   ';
    fixture.componentInstance.rename(space);
    http.expectNone((req) => req.method === 'PATCH');
  });

  it('confirms cascade deletion, sends one DELETE, then clears the removed space and cellar', () => {
    const confirmed = new Subject<boolean>();
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => confirmed.asObservable() } as MatDialogRef<DeleteSpaceDialogComponent>);
    fixture.componentInstance.delete(workspace.spaces()[0]);
    fixture.componentInstance.delete(workspace.spaces()[0]);
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(DeleteSpaceDialogComponent, expect.objectContaining({ panelClass: 'destructive-confirmation-dialog' }));
    http.expectNone((req) => req.method === 'DELETE');
    confirmed.next(true);
    const request = http.expectOne(`${base}/api/v1/spaces/space-1`);
    expect(request.request.method).toBe('DELETE');
    expect(workspace.selection().space?.id.value).toBe('space-1');
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(workspace.selection().space).toBeNull();
    expect(workspace.cellars()).toEqual([]);
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [directory.spaces[1]], wine_cellars: [] });
    expect(workspace.spaces().map((space) => space.name)).toEqual(['South']);
    expect(fixture.componentInstance.pendingId).toBeNull();
    http.expectNone((req) => req.method === 'DELETE');
  });

  it('cancels destructive confirmation without deleting or changing selection', () => {
    const confirmed = new Subject<boolean>();
    vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => confirmed.asObservable() } as MatDialogRef<DeleteSpaceDialogComponent>);
    fixture.componentInstance.delete(workspace.spaces()[0]);
    confirmed.next(false);
    http.expectNone((req) => req.method === 'DELETE');
    expect(workspace.selection().space?.id.value).toBe('space-1');
    expect(fixture.componentInstance.pendingId).toBeNull();
  });

  it('keeps existing data and permits retry when renaming fails', () => {
    const space = workspace.spaces()[0];
    fixture.componentInstance.edit(space);
    fixture.componentInstance.name = 'Home';
    fixture.componentInstance.rename(space);
    http.expectOne(`${base}/api/v1/spaces/space-1/name`).flush({}, { status: 500, statusText: 'Server Error' });
    expect(workspace.selection().space?.name).toBe('North');
    expect(fixture.componentInstance.editingId).toBe('space-1');
    expect(fixture.componentInstance.error).toContain('Unable to rename');
    expect(fixture.componentInstance.pendingId).toBeNull();
  });
});
