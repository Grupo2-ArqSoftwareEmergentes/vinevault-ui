import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';

export const workspaceGuard: CanActivateFn = (_route, state) => {
  const workspace = inject(WorkspaceContextService);
  const router = inject(Router);
  return workspace.whenReady().pipe(map((ready) => {
    // Do not mistake an offline/forbidden context for an empty account.
    if (!ready) return true;
    if (state.url.startsWith('/onboarding')) return workspace.spaces().length ? router.parseUrl('/overview') : true;
    return workspace.spaces().length ? true : router.parseUrl('/onboarding');
  }));
};
