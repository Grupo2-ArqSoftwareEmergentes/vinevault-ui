import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { vi } from 'vitest';
import { WorkspaceApiService, workspaceErrorMessage } from './workspace-api.service';
import { WorkspaceContextService } from './workspace-context.service';
import { StorageService } from '../../core/services/storage/storage';
import { authInterceptor } from '../../core/interceptors/auth/auth-interceptor';
import { API_CONFIG } from '../../api.config';
import { WineCellarHttpGateway } from '../../cava/infrastructure/api/gateways/wine-cellar-http.gateway';
import { SpaceDevicesSelectionHydrationService } from '../../device/interfaces/pages/space-devices-page/space-devices-selection-hydration.service';
import { DEVICE_QUERY_SERVICE } from '../../device/domain/services/device-query-service';

const spaceId = '11111111-1111-4111-8111-111111111111';
const cellarId = '22222222-2222-4222-8222-222222222222';
const contextResource = { spaces: [{ id: spaceId, name: 'Casa' }], wine_cellars: [{ id: cellarId, name: 'Principal', space_id: spaceId }] };
const createdSpaceResource = {
  id: spaceId, name: 'Casa',
  default_wine_cellar: {
    id: cellarId, space_id: spaceId, name: 'Principal', description: null,
    device_id: null, created_at: null, updated_at: null,
  },
};
const createdWorkspace = {
  space: { id: { value: spaceId }, name: 'Casa' },
  cellar: { id: { value: cellarId }, spaceId: { value: spaceId }, name: 'Principal' },
};
const base = API_CONFIG.baseUrl;

describe('Simplified workspace HTTP contract', () => {
  let http: HttpTestingController;
  let api: WorkspaceApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: { get: (key: string) => key === 'access_token' ? 'user-jwt' : null } },
        { provide: DEVICE_QUERY_SERVICE, useValue: {} },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(WorkspaceApiService);
  });

  afterEach(() => http.verify());

  it('uses exactly one authenticated context request and maps snake_case without fabricated metadata', () => {
    const result = vi.fn();
    api.getContext().subscribe(result);
    const request = http.expectOne(`${base}/api/v1/user/context`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer user-jwt');
    expect(request.request.method).toBe('GET');
    request.flush(contextResource);
    expect(result).toHaveBeenCalledWith({
      spaces: [{ id: { value: spaceId }, name: 'Casa' }],
      cellars: [{ id: { value: cellarId }, name: 'Principal', spaceId: { value: spaceId } }],
    });
    http.expectNone((req) => req.url.includes('/organizations'));
  });

  it('supports an empty context without creating or selecting anything', () => {
    const workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [], wine_cellars: [] });
    expect(workspace.selection()).toEqual({ space: null, cellar: null });
    expect(workspace.spaces()).toEqual([]);
    http.expectNone((req) => req.method === 'POST');
  });

  it('maps the created space and its default cellar without losing either identifier', () => {
    const result = vi.fn();
    api.createSpace('Casa').subscribe(result);
    http.expectOne(`${base}/api/v1/spaces`).flush(createdSpaceResource);
    expect(result).toHaveBeenCalledWith(createdWorkspace);
  });

  it('creates only the space and selects its backend-created cellar after refreshing, including both URL IDs', async () => {
    const workspace = TestBed.inject(WorkspaceContextService);
    const router = TestBed.inject(Router);
    const completed = firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationEnd), take(1)));
    const result = vi.fn();
    workspace.createSpace(' Casa ').subscribe(result);
    const post = http.expectOne(`${base}/api/v1/spaces`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ name: 'Casa' });
    expect(post.request.headers.get('Authorization')).toBe('Bearer user-jwt');
    post.flush(createdSpaceResource);
    expect(workspace.spaces()).toContainEqual(createdWorkspace.space);
    expect(workspace.cellars()).toContainEqual(createdWorkspace.cellar);
    http.expectOne(`${base}/api/v1/user/context`).flush(contextResource);
    await completed;
    expect(result).toHaveBeenCalledWith(createdWorkspace);
    expect(workspace.selection().space?.id.value).toBe(spaceId);
    expect(workspace.selection().cellar?.id.value).toBe(cellarId);
    expect(router.parseUrl(router.url).queryParams).toEqual({ spaceId, wineCellarId: cellarId });
    http.expectNone((req) => req.method === 'POST');
    http.expectNone((req) => req.url.includes('/organizations'));
  });

  for (const stale of [false, true]) {
    it(`keeps the committed space and default cellar when context refresh ${stale ? 'returns stale data' : 'fails'}, without another POST`, async () => {
      const workspace = TestBed.inject(WorkspaceContextService);
      const router = TestBed.inject(Router);
      const completed = firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationEnd), take(1)));
      const result = vi.fn();
      const error = vi.fn();
      workspace.createSpace('Casa').subscribe({ next: result, error });
      http.expectOne(`${base}/api/v1/spaces`).flush(createdSpaceResource);
      const refresh = http.expectOne(`${base}/api/v1/user/context`);
      if (stale) refresh.flush({ spaces: [], wine_cellars: [] });
      else refresh.flush({}, { status: 500, statusText: 'Server Error' });
      await completed;
      expect(result).toHaveBeenCalledWith(createdWorkspace);
      expect(error).not.toHaveBeenCalled();
      expect(workspace.spaces()).toContainEqual(createdWorkspace.space);
      expect(workspace.cellars()).toContainEqual(createdWorkspace.cellar);
      expect(workspace.selection()).toEqual(createdWorkspace);
      expect(router.parseUrl(router.url).queryParams).toEqual({ spaceId, wineCellarId: cellarId });
      expect(workspace.loading()).toBe(false);
      http.expectNone((req) => req.method === 'POST');
    });
  }

  it('hydrates device deep-link spaces from GET /spaces without walking organizations', () => {
    const result = vi.fn();
    TestBed.inject(SpaceDevicesSelectionHydrationService).hydrateFromSpaceId(spaceId).subscribe(result);
    const request = http.expectOne(`${base}/api/v1/spaces`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer user-jwt');
    request.flush([{ id: spaceId, name: 'Casa' }]);
    expect(result).toHaveBeenCalledWith({ id: { value: spaceId }, name: 'Casa' });
  });

  it('lists global or filtered wine-cellars using a single unambiguous query parameter', () => {
    const gateway = TestBed.inject(WineCellarHttpGateway);
    gateway.getWineCellars().subscribe();
    http.expectOne(`${base}/api/v1/wine-cellars`).flush([]);
    gateway.getWineCellarsBySpace(spaceId).subscribe();
    const request = http.expectOne(`${base}/api/v1/wine-cellars?spaceId=${spaceId}`);
    expect(request.request.params.has('space_id')).toBe(false);
    expect(request.request.headers.get('Authorization')).toBe('Bearer user-jwt');
    request.flush([]);
  });

  it('retains the existing nested creation route for wine cellars', () => {
    TestBed.inject(WineCellarHttpGateway).createWineCellar(spaceId, { name: 'Principal', description: null }).subscribe();
    const request = http.expectOne(`${base}/api/v1/spaces/${spaceId}/wine-cellars`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Principal', description: null });
    expect(request.request.headers.get('Authorization')).toBe('Bearer user-jwt');
    request.flush({ id: cellarId, name: 'Principal', space_id: spaceId });
  });

  it('refreshes context after renaming/removing spaces and cellar mutations', () => {
    const workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    http.expectOne(`${base}/api/v1/user/context`).flush(contextResource);
    workspace.chooseCellar(cellarId, false);
    workspace.updateSpace({ id: { value: spaceId }, name: 'Casa nueva' });
    http.expectOne(`${base}/api/v1/user/context`).flush({ ...contextResource, spaces: [{ id: spaceId, name: 'Casa nueva' }] });
    expect(workspace.selection().space?.name).toBe('Casa nueva');
    workspace.removeCellar(cellarId);
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [{ id: spaceId, name: 'Casa nueva' }], wine_cellars: [] });
    expect(workspace.selection().cellar).toBeNull();
    workspace.removeSpace(spaceId);
    expect(workspace.spaces()).toEqual([]);
    expect(workspace.cellars()).toEqual([]);
    expect(workspace.selection().space).toBeNull();
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [], wine_cellars: [] });
    expect(workspace.selection().space).toBeNull();
  });

  it('does not replace missing sensor metadata with an unlinked assumption', () => {
    const workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    http.expectOne(`${base}/api/v1/user/context`).flush(contextResource);
    workspace.chooseCellar(cellarId, false);
    const result = vi.fn();
    workspace.getCellarDetails(cellarId).subscribe(result);
    http.expectOne(`${base}/api/v1/wine-cellars?spaceId=${spaceId}`).flush([{
      id: cellarId, name: 'Principal', space_id: spaceId, device_id: '33333333-3333-4333-8333-333333333333',
      description: null, created_at: null, updated_at: null,
    }]);
    expect(result.mock.calls[0][0].deviceId.value).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('reports a 409 without changing the current directory or issuing an organization request', () => {
    const error = vi.fn();
    api.createSpace('Sixth space').subscribe({ error });
    http.expectOne(`${base}/api/v1/spaces`).flush({ detail: 'Space limit reached' }, { status: 409, statusText: 'Conflict' });
    expect(workspaceErrorMessage(error.mock.calls[0][0], 'Fallback')).toBe('Space limit reached');
    http.expectNone((req) => req.url.includes('/organizations'));
  });
});

describe('Workspace error messages', () => {
  for (const [status, expected] of [[401, 'sign in again'], [403, 'permission'], [404, 'no longer exists'], [409, 'limit'], [422, 'Check the name']] as const) {
    it(`handles HTTP ${status}`, () => {
      expect(workspaceErrorMessage(new HttpErrorResponse({ status }), 'Fallback')).toContain(expected);
    });
  }
});
