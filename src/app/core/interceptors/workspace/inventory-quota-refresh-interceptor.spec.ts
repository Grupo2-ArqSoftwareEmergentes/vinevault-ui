import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { inventoryQuotaRefreshInterceptor } from './inventory-quota-refresh-interceptor';
import { ErrorInterceptor } from '../error/error-interceptor';
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { NotificationService } from '../../services/notification/notification';
import { StorageService } from '../../services/storage/storage';
import { ownerResourceAccess } from '../../../shared/testing/workspace.fixtures';
import { API_CONFIG } from '../../../api.config';

const base = API_CONFIG.baseUrl + '/api/v1';
const account = { extra_spaces_allowance: 0, current_spaces: 1, max_spaces: 2, remaining_spaces: 1, can_create_collector: false, can_create_business: true };
const quotas = { cellars: { used: 1, limit: 1, remaining: 0 }, bottles: { used: 49, limit: 50, remaining: 1 }, skus: { used: 3, limit: null, remaining: null } };
const directory = { spaces: [{ ...ownerResourceAccess, id: 'space-1', name: 'Space', extra_cellars_allowance: 0, quotas }], wine_cellars: [{ id: 'cellar-1', space_id: 'space-1', name: 'Principal' }], account_quota: account };

describe('Quota state and mutation lifecycle', () => {
  let http: HttpTestingController;
  let workspace: WorkspaceContextService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(withInterceptors([inventoryQuotaRefreshInterceptor]), withInterceptorsFromDi()), provideHttpClientTesting(),
      { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
      { provide: NotificationService, useValue: { show: vi.fn() } },
    ] });
    http = TestBed.inject(HttpTestingController);
    workspace = TestBed.inject(WorkspaceContextService);
    TestBed.inject(StorageService).set('access_token', 'test-token');
    workspace.ensureLoaded();
    http.expectOne(`${base}/user/context`).flush(directory);
    workspace.chooseCellar('cellar-1', false);
  });
  afterEach(() => { http.verify(); TestBed.inject(StorageService).remove('access_token'); });

  it('maps account and per-space quotas, updates reactive selection and clears them on logout', () => {
    expect(workspace.accountQuota()).toEqual(account);
    expect(workspace.selection().space?.extra_cellars_allowance).toBe(0);
    expect(workspace.selection().space?.quotas).toEqual(quotas);
    workspace.resetSession();
    expect(workspace.accountQuota()).toBeUndefined();
    expect(workspace.spaces()).toEqual([]);
  });

  for (const [method, suffix] of [['POST', ''], ['PATCH', '/item-1'], ['DELETE', '/item-1'], ['POST', '/import'], ['POST', '/item-1/movements']]) {
    it(`refreshes authoritative totals exactly once after ${method} inventory${suffix}`, () => {
      const url = `${base}/wine-cellars/cellar-1/inventory${suffix}`;
      TestBed.inject(HttpClient).request(method, url, { body: {} }).subscribe();
      http.expectOne(url).flush({});
      http.expectOne(`${base}/user/context`).flush({ ...directory, spaces: [{ ...directory.spaces[0], quotas: { ...quotas, bottles: { used: 50, limit: 50, remaining: 0 } } }] });
      expect(workspace.selection().space?.quotas?.bottles.used).toBe(50);
      http.expectNone(`${base}/user/context`);
    });
  }

  for (const code of ['SPACE_LIMIT_REACHED', 'CELLAR_LIMIT_REACHED', 'ITEM_LIMIT_REACHED']) {
    it(`preserves session and selected context on ${code}, shows its message and resyncs counters`, () => {
      const signal = TestBed.inject(WorkspaceScopeService).signal;
      const url = `${base}/wine-cellars/cellar-1/inventory`;
      const received = vi.fn();
      TestBed.inject(HttpClient).post(url, {}).subscribe({ error: received });
      http.expectOne(url).flush({ detail: { code, message: 'Amplía tu cupo' } }, { status: 403, statusText: 'Forbidden' });
      expect(received).toHaveBeenCalledOnce();
      expect(workspace.selection().cellar?.id.value).toBe('cellar-1');
      expect(TestBed.inject(StorageService).get('access_token')).toBe('test-token');
      expect(signal.aborted).toBe(false);
      expect(TestBed.inject(NotificationService).show).toHaveBeenCalledWith('Amplía tu cupo', 'error');
      http.expectOne(`${base}/user/context`).flush(directory);
      expect(workspace.selection().space?.id.value).toBe('space-1');
      expect(workspace.accountQuota()?.can_create_business).toBe(true);
      http.expectNone(url);
    });
  }

  it('does not recursively refresh if the context endpoint rejects a quota read', () => {
    workspace.refresh();
    http.expectOne(`${base}/user/context`).flush({ detail: { code: 'ITEM_LIMIT_REACHED', message: 'Quota read rejected' } }, { status: 403, statusText: 'Forbidden' });
    expect(workspace.selection().space?.id.value).toBe('space-1');
    expect(workspace.accountQuota()).toEqual(account);
    http.expectNone(`${base}/user/context`);
  });
});
