import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PlanFeatureNoticeComponent } from './plan-feature-notice';
import { WorkspaceAccessService } from '../../services/workspace-access.service';
import { WorkspaceScopeService } from '../../services/workspace-scope.service';
import { ownerAccess } from '../../testing/workspace.fixtures';

@Component({ imports: [PlanFeatureNoticeComponent], template: '<app-plan-feature-notice feature="pdf_report" />' })
class Host {}

describe('Space feature restriction notice', () => {
  afterEach(() => vi.restoreAllMocks());
  it('offers an owner the upgrade of the selected space, never granting capabilities', async () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
    const access = TestBed.inject(WorkspaceAccessService);
    const scope = TestBed.inject(WorkspaceScopeService);
    vi.spyOn(access, 'capabilities').mockReturnValue({ pdf_report: false });
    scope.activate({ ...ownerAccess, id: { value: 'selected' }, name: 'Selected' });
    const fixture = TestBed.createComponent(Host); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Requiere Pro');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/subscription?spaceId=selected');
    expect(access.hasFeature('pdf_report')).toBe(false);
    scope.activate({ ...ownerAccess, role: 'WAITER', id: { value: 'other' }, name: 'Other' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(access.hasFeature('pdf_report')).toBe(false);
  });
});
