import { Injectable, Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LogoutUseCase } from '../../iam/domain/use-cases/logout/logout';
import { WorkspaceContextService } from '../../shared/services/workspace-context.service';
import { NotificationService } from './notification/notification';

@Injectable({ providedIn: 'root' })
export class SessionAccessService {
  private readonly injector = inject(Injector);
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
