import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { workspaceGuard } from './workspace-guard';
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';

describe('Workspace onboarding routing', () => {
  let ready: boolean;
  let spaces: unknown[];
  beforeEach(() => {
    ready = true;
    spaces = [];
    TestBed.configureTestingModule({ providers: [provideRouter([]), {
      provide: WorkspaceContextService, useValue: { whenReady: () => of(ready), spaces: () => spaces },
    }] });
  });

  async function check(url: string): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() => workspaceGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('routes an empty account to onboarding without creating any data', async () => {
    expect((await check('/overview')).toString()).toBe('/onboarding');
    expect(await check('/onboarding')).toBe(true);
  });

  it('does not offer first-space creation again when memberships exist', async () => {
    spaces = [{ id: 'shared-space', role: 'WAITER' }];
    expect((await check('/onboarding')).toString()).toBe('/overview');
    expect(await check('/inventory')).toBe(true);
  });

  it('never interprets an offline/forbidden context as an empty account', async () => {
    ready = false;
    expect(await check('/overview')).toBe(true);
  });
});
