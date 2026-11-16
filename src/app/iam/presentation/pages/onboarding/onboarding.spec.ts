import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { OnboardingComponent } from './onboarding';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { ownerResourceAccess } from '../../../../shared/testing/workspace.fixtures';
import { API_CONFIG } from '../../../../api.config';
import { AuthRepository } from '../../../data/repositories/auth-repository/auth-repository';

@Component({ standalone: true, template: '' })
class OverviewTestPage {}

const created = {
  ...ownerResourceAccess, id: 'space-1', name: 'Home',
  default_wine_cellar: { id: 'cellar-1', space_id: 'space-1', name: 'Principal', description: null, device_id: null, created_at: null, updated_at: null },
};
const base = API_CONFIG.baseUrl;

describe('First-space onboarding', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [OnboardingComponent],
    providers: [provideRouter([{ path: 'overview', component: OverviewTestPage }]), provideHttpClient(), provideHttpClientTesting()],
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  for (const spaceType of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`creates a ${spaceType} space once and selects its included cellar even if refresh fails`, async () => {
      const workspace = TestBed.inject(WorkspaceContextService);
      const http = TestBed.inject(HttpTestingController);
      workspace.ensureLoaded();
      http.expectOne(`${base}/api/v1/user/context`).flush({ spaces: [], wine_cellars: [] });
      const fixture = TestBed.createComponent(OnboardingComponent);
      await fixture.whenStable();
      fixture.componentInstance.name = ' Home ';
      fixture.componentInstance.spaceType = spaceType;
      fixture.componentInstance.submit();
      fixture.componentInstance.submit();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[type="submit"]').disabled).toBe(true);
      const post = http.expectOne(`${base}/api/v1/user/onboarding`);
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({ name: 'Home', space_type: spaceType });
      post.flush({ ...created, space_type: spaceType });
      http.expectOne(`${base}/api/v1/user/context`).flush({}, { status: 503, statusText: 'Unavailable' });
      await fixture.whenStable();
      expect(workspace.selection().space?.spaceType).toBe(spaceType);
      expect(workspace.selection().cellar?.id.value).toBe('cellar-1');
      expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({ spaceId: 'space-1', wineCellarId: 'cellar-1' });
      fixture.componentInstance.submit();
      http.expectNone((request) => request.method === 'POST');
      expect(fixture.componentInstance.completed).toBe(true);
    });
  }

  it('does not submit before the context is known or when a first space already exists', async () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.componentInstance.name = 'Home';
    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController).expectNone((request) => request.method === 'POST');
    const workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    TestBed.inject(HttpTestingController).expectOne(`${base}/api/v1/user/context`).flush({ spaces: [created], wine_cellars: [] });
    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController).expectNone((request) => request.method === 'POST');
  });

  it('posts only email, password and full_name when registering', () => {
    TestBed.inject(AuthRepository).register({ email: ' collector@example.com ', password: 'Cellar123!', full_name: ' Collector Name ' }).subscribe();
    const post = TestBed.inject(HttpTestingController).expectOne(`${base}/api/v1/iam/register`);
    expect(post.request.body).toEqual({ email: 'collector@example.com', password: 'Cellar123!', full_name: 'Collector Name' });
    post.flush({ id: 1, username: 'collector@example.com', email: 'collector@example.com', full_name: 'Collector Name' });
  });
});
