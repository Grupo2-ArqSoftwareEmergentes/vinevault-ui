import { Injectable, Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LogoutUseCase } from '../../iam/domain/use-cases/logout/logout';
import { WorkspaceContextService } from '../../shared/services/workspace-context.service';
import { NotificationService } from './notification/notification';
import { QuotaErrorCode } from '../../shared/services/workspace-quota';
import { CellarLimitService } from '../../shared/services/cellar-limit.service';
import { CreateSpaceDialogComponent } from '../../shared/components/create-space-dialog/create-space-dialog';

@Injectable({ providedIn: 'root' })
export class SessionAccessService {
  private readonly injector = inject(Injector);

  handleQuota(message: string, url = '', code?: QuotaErrorCode, current?: number, limit?: number): void {
    if (code === 'CELLAR_LIMIT_REACHED' || code === 'ITEM_LIMIT_REACHED') {
      const spaceId = /\/spaces\/([^/?]+)\/wine-cellars/.exec(url)?.[1];
      const opened = this.injector.get(CellarLimitService).open(
        spaceId ? decodeURIComponent(spaceId) : undefined,
        { reason: code === 'ITEM_LIMIT_REACHED' ? 'items' : 'cellars', current, limit, message }
      );
      if (!opened) this.injector.get(NotificationService).show(message, 'error');
    } else if (code === 'SPACE_LIMIT_REACHED') {
      const summary = typeof current === 'number' && typeof limit === 'number' ? `${message} (${current} / ${limit})` : message;
      const dialog = this.injector.get(MatDialog);
      if (!dialog.openDialogs.some((ref) => ref.componentInstance instanceof CreateSpaceDialogComponent)) {
        dialog.open(CreateSpaceDialogComponent, {
          width: '800px',
          maxWidth: 'calc(100vw - 32px)',
          panelClass: 'device-management-dialog',
          ariaLabelledBy: 'create-space-title',
          data: { mode: 'extra-space', current, limit, message },
        });
      }
      this.injector.get(NotificationService).show(summary, 'error');
    } else {
      this.injector.get(NotificationService).show(message, 'error');
    }
    // A capacity rejection is not revoked membership. Keep credentials and selection.
    if (!url.includes('/user/context')) this.injector.get(WorkspaceContextService).refresh();
  }

  handlePlanFeatureUnavailable(message: string): void {
    this.injector.get(NotificationService).show(
      message || 'Esta función requiere Pro en el espacio seleccionado.',
      'error'
    );
  }

  handleInsufficientSpacePermission(message: string): void {
    this.injector.get(NotificationService).show(
      message || 'No tienes permisos suficientes sobre este espacio para esta acción.',
      'error'
    );
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
