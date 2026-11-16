import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { SpacesManagementComponent } from './spaces-management';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { DEVICE_COMMAND_SERVICE } from '../../../device/domain/services/device-command-service';
import { DeviceCommandServiceImpl } from '../../../device/application/internal/commandservices/device-command-service.impl';
import { DeleteSpaceDialogComponent } from '../../../device/interfaces/components/delete-space-dialog/delete-space-dialog.component';
import { API_CONFIG } from '../../../api.config';
import { ownerResourceAccess } from '../../testing/workspace.fixtures';
import { routes } from '../../../app.routes';
import { AuthGuard } from '../../../core/guards/auth/auth-guard';

const base = API_CONFIG.baseUrl;
const directory = {
  spaces: [
    { ...ownerResourceAccess, id: 'space-1', name: 'North' },
    { ...ownerResourceAccess, id: 'space-2', name: 'Restaurant', space_type: 'BUSINESS', subscription_plan: 'PRO', subscription_status: 'EXPIRED', role: 'SOMMELIER' },
    { id: 'space-3', name: 'Legacy' },
  ],
  wine_cellars: [{ id: 'cellar-1', name: 'Reserve', space_id: 'space-1' }],
};

describe('Spaces management page', () => {
  let fixture: ComponentFixture<SpacesManagementComponent>;
  let workspace: WorkspaceContextService;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SpacesManagementComponent], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: DEVICE_COMMAND_SERVICE, useClass: DeviceCommandServiceImpl },
    ] });
    http = TestBed.inject(HttpTestingController);
    workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    http.expectOne(`${base}/api/v1/user/context`).flush(directory);
    workspace.chooseCellar('cellar-1', false);
    fixture = TestBed.createComponent(SpacesManagementComponent);
    await fixture.whenStable();
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('registers an authenticated route that also permits empty accounts', () => {
    const route = routes.find((route) => route.path === 'spaces')!;
    expect(route.component).toBe(SpacesManagementComponent);
    expect(route.canActivate).toEqual([AuthGuard]);
  });

  it('lists every membership, displays real metadata and restricts actions per card', () => {
    const cards = fixture.nativeElement.querySelectorAll('.space-card') as NodeListOf<HTMLElement>;
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain('COLLECTOR');
    expect(cards[0].textContent).toContain('FREE');
    expect(cards[0].textContent).toContain('ACTIVE');
    expect(cards[0].textContent).toContain('OWNER');
    expect(cards[0].querySelectorAll('button')).toHaveLength(2);
    expect(cards[1].textContent).toContain('BUSINESS');
    expect(cards[1].textContent).toContain('PRO');
    expect(cards[1].textContent).toContain('EXPIRED');
    expect(cards[1].textContent).toContain('SOMMELIER');
    expect(cards[1].querySelector('button')).toBeNull();
    expect(cards[2].textContent).toContain('Not available');
    expect(cards[2].querySelector('button')).toBeNull();
    for (const space of workspace.spaces().slice(1)) {
      fixture.componentInstance.edit(space);
      fixture.componentInstance.name = 'Forbidden';
      fixture.componentInstance.rename(space);
      fixture.componentInstance.delete(space);
    }
    http.expectNone((request) => request.method === 'PATCH' || request.method === 'DELETE');
  });

  it('cancels editing without a mutation', async () => {
    fixture.nativeElement.querySelector('[aria-label="Edit North"]').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').value).toBe('North');
    fixture.nativeElement.querySelector('.rename-form button[type="button"]').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.rename-form')).toBeNull();
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('trims a rename, locks repeated requests and updates the global context after success', async () => {
    const component = fixture.componentInstance;
    const space = workspace.spaces()[0];
    component.edit(space);
    component.name = '   ';
    component.rename(space);
    http.expectNone((request) => request.method === 'PATCH');
    component.name = '  Home  ';
    component.rename(space);
    component.rename(space);
    const request = http.expectOne(`${base}/api/v1/spaces/space-1/name`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Home' });
    expect(workspace.selection().space?.name).toBe('North');
    request.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(`${base}/api/v1/user/context`).flush({ ...directory, spaces: [{ ...directory.spaces[0], name: 'Home' }, ...directory.spaces.slice(1)] });
    await fixture.whenStable();
    expect(workspace.selection().space?.name).toBe('Home');
    expect(component.pendingId).toBeNull();
    expect(component.editingId).toBeNull();
  });

  it('keeps the name and unlocks retry after a failed rename', async () => {
    const component = fixture.componentInstance;
    component.edit(workspace.spaces()[0]);
    component.name = 'Home';
    component.rename(workspace.spaces()[0]);
    http.expectOne(`${base}/api/v1/spaces/space-1/name`).flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Unable to rename');
    expect(component.pendingId).toBeNull();
    expect(component.editingId).toBe('space-1');
    expect(workspace.spaces()[0].name).toBe('North');
  });

  for (const confirm of [true, false]) {
    it(`${confirm ? 'confirms' : 'cancels'} destructive deletion before sending any DELETE`, () => {
      const confirmed = new Subject<boolean>();
      const open = vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({ afterClosed: () => confirmed.asObservable() } as MatDialogRef<DeleteSpaceDialogComponent>);
      const component = fixture.componentInstance;
      component.delete(workspace.spaces()[0]);
      component.delete(workspace.spaces()[0]);
      expect(open).toHaveBeenCalledExactlyOnceWith(DeleteSpaceDialogComponent, expect.objectContaining({ panelClass: 'destructive-confirmation-dialog' }));
      http.expectNone((request) => request.method === 'DELETE');
      confirmed.next(confirm);
      if (confirm) {
        const request = http.expectOne(`${base}/api/v1/spaces/space-1`);
        expect(request.request.method).toBe('DELETE');
        request.flush(null, { status: 204, statusText: 'No Content' });
        http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: directory.spaces.slice(1), wine_cellars: [] });
        expect(workspace.selection().space).toBeNull();
        expect(workspace.cellars()).toHaveLength(0);
      } else {
        http.expectNone((request) => request.method === 'DELETE');
        expect(workspace.selection().space?.name).toBe('North');
      }
      expect(component.pendingId).toBeNull();
    });
  }

  it('shows an empty state and refresh errors with a working retry', async () => {
    workspace.refresh();
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [], wine_cellars: [] });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No spaces yet');
    workspace.refresh();
    http.expectOne(`${base}/api/v1/user/context`).flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[role="alert"] button').click();
    http.expectOne(`${base}/api/v1/user/context`).flush(directory);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.space-card')).toHaveLength(3);
  });
});
