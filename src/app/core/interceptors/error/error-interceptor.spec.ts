import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { ErrorInterceptor } from './error-interceptor';
import { workspaceInterceptor } from '../workspace/workspace-interceptor';
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';
import { WorkspaceAccessService } from '../../../shared/services/workspace-access.service';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { StorageService } from '../../services/storage/storage';
import { NotificationService } from '../../services/notification/notification';
import { AuthStateService } from '../../../iam/presentation/state/auth-state/auth-state';
import { LogoutUseCase } from '../../../iam/domain/use-cases/logout/logout';
import { ownerResourceAccess } from '../../../shared/testing/workspace.fixtures';
import { workspaceErrorMessage } from '../../../shared/services/workspace-api.service';
import { API_CONFIG } from '../../../api.config';

const base = API_CONFIG.baseUrl;
const directory = { spaces: [{ ...ownerResourceAccess, id: 'space-1', name: 'Shared cellar' }], wine_cellars: [{ id: 'cellar-1', space_id: 'space-1', name: 'Reserve' }] };

describe('Session and space access errors', () => {
  let http: HttpTestingController;
  let workspace: WorkspaceContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([workspaceInterceptor]), withInterceptorsFromDi()), provideHttpClientTesting(),
      { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
      { provide: NotificationService, useValue: { show: vi.fn() } },
    ] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(StorageService).set('access_token', 'user-jwt');
    TestBed.inject(StorageService).set('refresh_token', 'refresh-jwt');
    TestBed.inject(AuthStateService).setAuthenticated({ id: 1, username: 'collector', email: 'collector@example.com' });
    workspace = TestBed.inject(WorkspaceContextService);
    http = TestBed.inject(HttpTestingController);
    workspace.ensureLoaded();
    http.expectOne(`${base}/api/v1/user/context`).flush(directory);
    workspace.chooseCellar('cellar-1', false);
  });

  afterEach(() => {
    http.verify();
    for (const key of ['access_token', 'refresh_token', 'accessToken', 'refreshToken']) TestBed.inject(StorageService).remove(key);
    vi.restoreAllMocks();
  });

  it('clears credentials, context, selection and pending scope on 401, then routes to login', () => {
    const oldSignal = TestBed.inject(WorkspaceScopeService).signal;
    TestBed.inject(HttpClient).get(`${base}/api/v1/spaces/space-1`).subscribe({ error: () => {} });
    http.expectOne(`${base}/api/v1/spaces/space-1`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(StorageService).get('access_token')).toBeNull();
    expect(TestBed.inject(StorageService).get('refresh_token')).toBeNull();
    expect(workspace.spaces()).toEqual([]);
    expect(workspace.selection()).toEqual({ space: null, cellar: null });
    expect(TestBed.inject(WorkspaceAccessService).canManage()).toBe(false);
    expect(oldSignal.aborted).toBe(true);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login']);
  });

  it('clears a forbidden selection and refreshes membership exactly once on 403', () => {
    TestBed.inject(HttpClient).delete(`${base}/api/v1/spaces/space-1`).subscribe({ error: () => {} });
    http.expectOne(`${base}/api/v1/spaces/space-1`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(workspace.selection()).toEqual({ space: null, cellar: null });
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [{ ...directory.spaces[0], role: 'WAITER' }], wine_cellars: directory.wine_cellars });
    expect(workspace.selection().space).toBeNull();
    expect(workspace.spaces()[0].role).toBe('WAITER');
    expect(TestBed.inject(StorageService).get('access_token')).toBe('user-jwt');
  });

  it('does not recursively refresh when the context endpoint itself returns 403', () => {
    workspace.refresh();
    http.expectOne(`${base}/api/v1/user/context`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(workspace.selection().space).toBeNull();
    expect(workspace.loading()).toBe(false);
    expect(workspace.error()).toContain('permission');
    http.expectNone(`${base}/api/v1/user/context`);
  });

  for (const status of [403, 401]) {
    it(`handles an inventory export Blob error ${status} without mistaking it for a downloadable file`, () => {
      const previous = workspace.selection();
      const signal = TestBed.inject(WorkspaceScopeService).signal;
      const url = base + API_CONFIG.endpoints.exportInventory;
      TestBed.inject(HttpClient).get(url, { responseType: 'blob' }).subscribe({ error: () => {} });
      http.expectOne(url).flush(new Blob(['{"detail":"Sin acceso"}'], { type: 'application/json' }), { status, statusText: status === 403 ? 'Forbidden' : 'Unauthorized' });
      if (status === 403) {
        expect(workspace.selection()).toBe(previous);
        expect(signal.aborted).toBe(false);
        expect(TestBed.inject(NotificationService).show).not.toHaveBeenCalled();
        http.expectNone(`${base}/api/v1/user/context`);
      } else {
        expect(TestBed.inject(StorageService).get('access_token')).toBeNull();
        expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login']);
      }
    });
  }

  for (const endpoint of [API_CONFIG.endpoints.autocompleteWine, API_CONFIG.endpoints.assistantChat]) {
    const body = endpoint === API_CONFIG.endpoints.assistantChat
      ? { space_id: 'space-1', mode: 'CHAT', message: 'Consulta', history: [] }
      : { wine_name: 'Reserva' };
    it(`keeps membership, credentials and draft scope on ${endpoint} permission 403`, () => {
      const previous = workspace.selection();
      const signal = TestBed.inject(WorkspaceScopeService).signal;
      const error = vi.fn();
      const url = base + endpoint;
      TestBed.inject(HttpClient).post(url, body).subscribe({ error });
      http.expectOne(url).flush({ detail: 'Analysis permission required' }, { status: 403, statusText: 'Forbidden' });
      expect(error).toHaveBeenCalledOnce();
      expect(workspace.selection()).toBe(previous);
      expect(signal.aborted).toBe(false);
      expect(TestBed.inject(StorageService).get('access_token')).toBe('user-jwt');
      expect(TestBed.inject(NotificationService).show).not.toHaveBeenCalled();
      http.expectNone(`${base}/api/v1/user/context`);
    });

    it(`still delegates ${endpoint} 401 to the normal logout flow`, () => {
      const url = base + endpoint;
      TestBed.inject(HttpClient).post(url, body).subscribe({ error: () => {} });
      http.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(workspace.selection().space).toBeNull();
      expect(TestBed.inject(StorageService).get('access_token')).toBeNull();
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login']);
    });
  }

  it('resets cached state on logout even when no /me profile was hydrated after reload', () => {
    TestBed.inject(AuthStateService).logout();
    workspace.ensureLoaded();
    http.expectOne(`${base}/api/v1/user/context`).flush(directory);
    workspace.chooseCellar('cellar-1', false);
    TestBed.inject(LogoutUseCase).execute().subscribe();
    expect(workspace.cellars()).toEqual([]);
    expect(workspace.loaded()).toBe(false);
    expect(TestBed.inject(WorkspaceAccessService).plan()).toBeNull();
  });

  it('retains backend validation details for 404, 409 and FastAPI 422 errors', () => {
    expect(workspaceErrorMessage(new HttpErrorResponse({ status: 404 }), 'Fallback')).toContain('no longer exists');
    expect(workspaceErrorMessage(new HttpErrorResponse({ status: 409, error: { detail: 'Space limit reached' } }), 'Fallback')).toBe('Space limit reached');
    expect(workspaceErrorMessage(new HttpErrorResponse({ status: 422, error: { detail: [{ loc: ['body', 'name'], msg: 'Name must not be blank' }] } }), 'Fallback')).toBe('Name must not be blank');
  });
});
