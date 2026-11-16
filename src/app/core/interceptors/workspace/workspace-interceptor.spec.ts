import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { workspaceInterceptor } from './workspace-interceptor';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { ownerAccess } from '../../../shared/testing/workspace.fixtures';
import { API_CONFIG } from '../../../api.config';

describe('Space request lifetime', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([workspaceInterceptor])), provideHttpClientTesting()] }));

  it('cancels old HTTP reads and writes on space changes without retries', () => {
    const scope = TestBed.inject(WorkspaceScopeService);
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    scope.activate({ ...ownerAccess, id: { value: 'a' }, name: 'A' });
    const next = vi.fn();
    http.get(`${API_CONFIG.baseUrl}/api/v1/spaces/a/devices`).subscribe(next);
    http.patch(`${API_CONFIG.baseUrl}/api/v1/devices/sensor/name`, { name: 'Updated' }).subscribe(next);
    const read = backend.expectOne(`${API_CONFIG.baseUrl}/api/v1/spaces/a/devices`);
    const write = backend.expectOne(`${API_CONFIG.baseUrl}/api/v1/devices/sensor/name`);
    const signal = scope.signal;
    scope.activate({ ...ownerAccess, id: { value: 'b' }, name: 'B' });
    expect(signal.aborted).toBe(true);
    expect(read.cancelled).toBe(true);
    expect(write.cancelled).toBe(true);
    expect(next).not.toHaveBeenCalled();
    backend.verify();
  });

  it('cancels requests on role revocation within the same space', () => {
    const scope = TestBed.inject(WorkspaceScopeService);
    scope.activate({ ...ownerAccess, id: { value: 'a' }, name: 'A' });
    TestBed.inject(HttpClient).get(`${API_CONFIG.baseUrl}/api/v1/wine-cellars?spaceId=a`).subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(`${API_CONFIG.baseUrl}/api/v1/wine-cellars?spaceId=a`);
    scope.activate({ ...ownerAccess, id: { value: 'a' }, name: 'A', role: 'WAITER' });
    expect(request.cancelled).toBe(true);
  });

  it('does not abort global context or non-idempotent onboarding when selecting its created space', () => {
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    http.get(`${API_CONFIG.baseUrl}/api/v1/user/context`).subscribe();
    http.post(`${API_CONFIG.baseUrl}/api/v1/user/onboarding`, { name: 'Home', space_type: 'COLLECTOR' }).subscribe();
    const context = backend.expectOne(`${API_CONFIG.baseUrl}/api/v1/user/context`);
    const onboard = backend.expectOne(`${API_CONFIG.baseUrl}/api/v1/user/onboarding`);
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'a' }, name: 'A' });
    expect(context.cancelled).toBe(false);
    expect(onboard.cancelled).toBe(false);
    context.flush({}); onboard.flush({});
    backend.verify();
  });

  it('does abort global context and pending space creation when the session ends', () => {
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    http.get(`${API_CONFIG.baseUrl}/api/v1/user/context`).subscribe();
    http.post(`${API_CONFIG.baseUrl}/api/v1/spaces`, { name: 'Home', space_type: 'COLLECTOR' }).subscribe();
    const context = backend.expectOne(`${API_CONFIG.baseUrl}/api/v1/user/context`);
    const creation = backend.expectOne(`${API_CONFIG.baseUrl}/api/v1/spaces`);
    TestBed.inject(WorkspaceScopeService).invalidateSession();
    expect(context.cancelled).toBe(true);
    expect(creation.cancelled).toBe(true);
    backend.verify();
  });
});
