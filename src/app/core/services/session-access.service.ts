import { Injectable, Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LogoutUseCase } from '../../iam/domain/use-cases/logout/logout';
import { WorkspaceContextService } from '../../shared/services/workspace-context.service';
import { NotificationService } from './notification/notification';
import { QuotaErrorCode } from '../../shared/services/workspace-quota';
import { CellarLimitService } from '../../shared/services/cellar-limit.service';

@Injectable({ providedIn: 'root' })
export class SessionAccessService {
  private readonly injector = inject(Injector);
  handleQuota(message: string, url = '', code?: QuotaErrorCode): void {
    if (code === 'CELLAR_LIMIT_REACHED') {
      const spaceId = /\/spaces\/([^/?]+)\/wine-cellars/.exec(url)?.[1];
      this.injector.get(CellarLimitService).open(spaceId ? decodeURIComponent(spaceId) : undefined);
    } else this.injector.get(NotificationService).show(message, 'error');
    // A capacity rejection is not revoked membership. Keep credentials and selection.
    if (!url.includes('/user/context')) this.injector.get(WorkspaceContextService).refresh();
  }
  handle(status: number, url = ''): void {
    if (status === 401) {
      this.injector.get(LogoutUseCase).execute().subscribe();
      void this.injector.get(Router).navigate(['/login']);
    } else if (status === 403) {
      this.injector.get(NotificationService).show('You no longer have access to this space or action. Your spaces have been refreshed.', 'error');
      this.injector.get(WorkspaceContextService).accessRevoked(!url.includes('/user/context'));
    }
  }
}
