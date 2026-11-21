import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { RegistrationFlowService } from './registration-flow.service';
import { SignupIntentService } from './signup-intent';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { ownerResourceAccess } from '../../../../shared/testing/workspace.fixtures';
import { StorageService } from '../../../../core/services/storage/storage';
import { authInterceptor } from '../../../../core/interceptors/auth/auth-interceptor';
import { API_CONFIG } from '../../../../api.config';
import { RegisterComponent } from '../../pages/register/register';

const base = API_CONFIG.baseUrl;
const user = { id: 1, username: 'collector@example.com', email: 'collector@example.com', full_name: 'Collector' };
const payload = { full_name: 'Collector', email: 'collector@example.com', password: 'Cellar123!' };
const cellar = { id: 'cellar-1', space_id: 'space-1', name: 'Cava Principal', description: null, device_id: null, created_at: null, updated_at: null };
const space = { ...ownerResourceAccess, id: 'space-1', name: 'Mi colección' };

describe('Intent → account → authenticated space → inventory', () => {
  let http: HttpTestingController;
  let intent: SignupIntentService;

  beforeEach(() => {
    sessionStorage.removeItem('vinevault_signup_intent');
    TestBed.configureTestingModule({ imports: [RegisterComponent], providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpTestingController);
    intent = TestBed.inject(SignupIntentService);
    intent.select('COLLECTOR');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    intent.clear();
    for (const key of ['access_token', 'refresh_token', 'accessToken', 'refreshToken']) TestBed.inject(StorageService).remove(key);
    vi.restoreAllMocks();
  });

  function signIn(): void {
    const login = http.expectOne(`${base}/api/v1/iam/login`);
    expect(login.request.body.get('username')).toBe(payload.email);
    expect(login.request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    login.flush({ access_token: 'new-jwt', refresh_token: 'new-refresh', token_type: 'bearer' });
    const me = http.expectOne(`${base}/api/v1/iam/me`);
    expect(me.request.headers.get('Authorization')).toBe('Bearer new-jwt');
    me.flush(user);
  }

  for (const type of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`prepares ${type} and navigates straight to inventory without another cellar POST`, async () => {
      intent.select(type);
      const fixture = TestBed.createComponent(RegisterComponent);
      await fixture.whenStable();
      fixture.componentInstance.registerForm.setValue({ ...payload, confirmPassword: payload.password, acceptTerms: true });
      fixture.componentInstance.onSubmit();
      fixture.componentInstance.onSubmit();
      const register = http.expectOne(`${base}/api/v1/iam/register`);
      expect(register.request.body).toEqual(payload);
      register.flush(user);
      expect(intent.needsSetup(payload.email)).toBe(true);
      expect(sessionStorage.getItem('vinevault_signup_intent')).not.toContain(payload.password);
      signIn();
      expect(fixture.componentInstance.isLoading).toBe(true);
      fixture.componentInstance.onSubmit();
      http.expectNone(`${base}/api/v1/iam/register`);
      http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [], wine_cellars: [] });
      const onboarding = http.expectOne(`${base}/api/v1/user/onboarding`);
      expect(onboarding.request.headers.get('Authorization')).toBe('Bearer new-jwt');
      expect(onboarding.request.body).toEqual({ name: type === 'BUSINESS' ? 'Mi negocio' : 'Mi colección', space_type: type });
      const created = { ...space, space_type: type, name: onboarding.request.body.name };
      onboarding.flush({ ...created, default_wine_cellar: cellar });
      http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [created], wine_cellars: [cellar] });
      await fixture.whenStable();
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/inventory'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
      expect(TestBed.inject(WorkspaceContextService).selection().space?.spaceType).toBe(type);
      expect(TestBed.inject(WorkspaceContextService).selection().cellar?.name).toBe('Cava Principal');
      expect(intent.spaceType()).toBeNull();
      expect(fixture.componentInstance.isLoading).toBe(false);
      http.expectNone((request) => request.method === 'POST');
    });
  }

  it('does not re-register after automatic login fails; a manual retry checks context first', () => {
    const error = vi.fn();
    const flow = TestBed.inject(RegistrationFlowService);
    flow.complete(payload).subscribe({ error });
    http.expectOne(`${base}/api/v1/iam/register`).flush(user);
    http.expectOne(`${base}/api/v1/iam/login`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(error).toHaveBeenCalledOnce();
    expect(intent.needsSetup(payload.email)).toBe(true);
    const next = vi.fn();
    flow.complete(payload).subscribe(next);
    http.expectNone(`${base}/api/v1/iam/register`);
    signIn();
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [space], wine_cellars: [cellar] });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ cellar: expect.objectContaining({ name: 'Cava Principal' }) }));
    http.expectNone((request) => request.method === 'POST');
  });

  it('recovers a committed but disconnected onboarding without creating a second space or cellar', () => {
    const flow = TestBed.inject(RegistrationFlowService);
    flow.complete(payload).subscribe({ error: () => {} });
    http.expectOne(`${base}/api/v1/iam/register`).flush(user);
    signIn();
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [], wine_cellars: [] });
    http.expectOne(`${base}/api/v1/user/onboarding`).error(new ProgressEvent('error'));
    expect(intent.needsSetup(payload.email)).toBe(true);
    flow.complete(payload).subscribe();
    http.expectNone(`${base}/api/v1/iam/register`);
    signIn();
    http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [space], wine_cellars: [cellar] });
    expect(TestBed.inject(WorkspaceContextService).selection().cellar?.id.value).toBe('cellar-1');
    http.expectNone(`${base}/api/v1/user/onboarding`);
    http.expectNone((request) => request.url.includes('/wine-cellars') && request.method === 'POST');
  });

  it('does not create a recovery marker when account registration fails', () => {
    TestBed.inject(RegistrationFlowService).complete(payload).subscribe({ error: () => {} });
    http.expectOne(`${base}/api/v1/iam/register`).flush({ detail: 'Email already registered' }, { status: 409, statusText: 'Conflict' });
    expect(intent.needsSetup(payload.email)).toBe(false);
    http.expectNone(`${base}/api/v1/iam/login`);
    http.expectNone(`${base}/api/v1/user/onboarding`);
  });

  it('does not resume another account’s pending signup', () => {
    intent.accountCreated(payload.email);
    const next = vi.fn();
    TestBed.inject(RegistrationFlowService).finishPending('other@example.com').subscribe(next);
    expect(next).toHaveBeenCalledWith(null);
    http.expectNone((request) => request.url.includes('/user/'));
  });
});
