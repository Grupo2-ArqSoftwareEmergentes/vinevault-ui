import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { API_CONFIG } from '../../../api.config';
import { ProfileService } from './profile.service';
import { PREFERRED_LANGUAGE_STORAGE_KEY, UserProfile } from '../../domain/models/profile';
import { AuthStateService } from '../../presentation/state/auth-state/auth-state';
import { StorageService } from '../../../core/services/storage/storage';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';
import { WorkspaceApiService } from '../../../shared/services/workspace-api.service';
import { ownerAccess } from '../../../shared/testing/workspace.fixtures';
import { I18nService } from '../../../core/i18n/i18n.service';

const base = API_CONFIG.baseUrl;

const sampleProfile: UserProfile = {
  id: 1,
  username: 'sommelier1',
  email: 'sommelier@example.com',
  full_name: 'Ana Sommelier',
  preferred_language: 'es',
  is_active: true,
  created_at: '2026-11-19T22:00:00Z',
  updated_at: null,
  last_login: null,
};

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    localStorage.removeItem('access_token');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: WorkspaceApiService,
          useValue: {
            getContext: () => of({
              spaces: [{ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' }],
              cellars: [{ id: { value: 'cellar-1' }, spaceId: { value: 'space-1' }, name: 'Principal' }],
            }),
          },
        },
      ],
    });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('access_token');
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    document.documentElement.lang = 'es';
  });

  it('loads profile, syncs AuthStateService and language without resetting WorkspaceContextService on reload hydration', async () => {
    const workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    expect(workspace.spaces()).toHaveLength(1);
    expect(TestBed.inject(AuthStateService).getCurrentState().user).toBeNull();

    const promise = firstValueFrom(service.getProfile());
    http.expectOne(`${base}/api/v1/profile`).flush({ ...sampleProfile, preferred_language: 'en' });
    const loaded = await promise;

    expect(loaded.username).toBe('sommelier1');
    expect(service.profile()?.preferred_language).toBe('en');
    expect(TestBed.inject(AuthStateService).getCurrentState().user?.username).toBe('sommelier1');
    expect(TestBed.inject(StorageService).get<string>(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    // Reload hydration must NOT reset already-loaded spaces/cellars.
    expect(workspace.spaces()).toHaveLength(1);
    expect(workspace.selection().space?.id.value).toBe('space-1');
  });

  it('sends strictly trimmed partial payloads on PATCH /api/v1/profile and rejects empty updates', async () => {
    expect(() => service.updateProfile({})).toThrow();

    const promise = firstValueFrom(service.updateProfile({
      username: '  sommelier2  ',
      email: '  NEW@Example.COM ',
      preferred_language: 'en',
    }));
    const req = http.expectOne(`${base}/api/v1/profile`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      username: 'sommelier2',
      email: 'new@example.com',
      preferred_language: 'en',
    });
    req.flush({ ...sampleProfile, username: 'sommelier2', email: 'new@example.com', preferred_language: 'en' });
    const updated = await promise;

    expect(updated.username).toBe('sommelier2');
    expect(TestBed.inject(AuthStateService).getCurrentState().user?.username).toBe('sommelier2');
    expect(service.preferredLanguage()).toBe('en');
  });

  it('sends only current_password and new_password to POST /api/v1/profile/change-password and clears cache on session change', async () => {
    service.getProfile().subscribe();
    http.expectOne(`${base}/api/v1/profile`).flush(sampleProfile);
    expect(service.profile()).not.toBeNull();

    const promise = firstValueFrom(service.changePassword({ current_password: 'OldPassword123', new_password: 'NewPassword456' }));
    const req = http.expectOne(`${base}/api/v1/profile/change-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ current_password: 'OldPassword123', new_password: 'NewPassword456' });
    req.flush({ message: 'Password updated', sessions_revoked: false, security_notice: 'Existing tokens remain active.' });
    const response = await promise;
    expect(response.sessions_revoked).toBe(false);

    TestBed.inject(WorkspaceScopeService).invalidateSession();
    expect(service.profile()).toBeNull();
  });

  it('applies a language selection immediately and rolls back a failed PATCH without losing the profile', () => {
    service.getProfile().subscribe(); http.expectOne(`${base}/api/v1/profile`).flush(sampleProfile);
    const i18n = TestBed.inject(I18nService);
    service.updateProfile({ preferred_language: 'en' }).subscribe({ error: () => {} });
    expect(i18n.language()).toBe('en'); expect(document.documentElement.lang).toBe('en');
    expect(TestBed.inject(StorageService).get(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe('en');
    http.expectOne(`${base}/api/v1/profile`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(i18n.language()).toBe('es'); expect(document.documentElement.lang).toBe('es');
    expect(TestBed.inject(StorageService).get(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe('es');
    expect(service.profile()?.username).toBe(sampleProfile.username);
  });

  it('does not let an older profile read or an older language response overwrite the latest selection', () => {
    service.getProfile().subscribe(); const read = http.expectOne(`${base}/api/v1/profile`);
    service.updateProfile({ preferred_language: 'en' }).subscribe();
    const english = http.expectOne(req => req.method === 'PATCH');
    read.flush(sampleProfile); expect(service.preferredLanguage()).toBe('en');
    service.updateProfile({ preferred_language: 'es' }).subscribe();
    const spanish = http.expectOne(req => req.method === 'PATCH');
    spanish.flush(sampleProfile); english.flush({ ...sampleProfile, preferred_language: 'en' });
    expect(service.preferredLanguage()).toBe('es');
    expect(service.profile()?.preferred_language).toBe('es');
    expect(TestBed.inject(AuthStateService).getCurrentState().user?.preferred_language).toBe('es');
  });

  it('hydrates a stored session once, shares an in-flight profile read, and resynchronizes after account changes', async () => {
    const auth = TestBed.inject(AuthStateService);
    const storage = TestBed.inject(StorageService);
    storage.set('access_token', 'synthetic-token');
    service.connectAccount(); service.connectAccount(); service.getProfile().subscribe();
    await Promise.resolve();
    http.expectOne(`${base}/api/v1/profile`).flush({ ...sampleProfile, preferred_language: 'en' });
    expect(service.preferredLanguage()).toBe('en');
    http.expectNone(`${base}/api/v1/profile`);
    auth.setAuthenticated({ id: 2, username: 'another', email: 'another@example.invalid' });
    await Promise.resolve();
    http.expectOne(`${base}/api/v1/profile`).flush({ ...sampleProfile, id: 2, preferred_language: 'es' });
    expect(service.preferredLanguage()).toBe('es');
    storage.remove('access_token'); auth.logout(); TestBed.inject(WorkspaceScopeService).invalidateSession();
    expect(service.profile()).toBeNull();
    http.expectNone(`${base}/api/v1/profile`);
  });

  it('starts login hydration after workspace invalidation instead of cancelling the new account request', async () => {
    service.connectAccount();
    const workspace = TestBed.inject(WorkspaceContextService); workspace.ensureLoaded();
    TestBed.inject(AuthStateService).setAuthenticated({ id: 1, username: 'sommelier1', email: 'sommelier@example.com' });
    await Promise.resolve();
    const request = http.expectOne(`${base}/api/v1/profile`);
    expect(request.cancelled).toBe(false);
    request.flush({ ...sampleProfile, preferred_language: 'en' });
    expect(service.preferredLanguage()).toBe('en');
    http.expectNone(`${base}/api/v1/profile`);
  });
});
