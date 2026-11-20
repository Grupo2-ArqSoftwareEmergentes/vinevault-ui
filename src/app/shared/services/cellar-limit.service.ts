import { Injectable, Injector, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CellarLimitModalComponent, SpaceLimitModalData, SpaceLimitModalOptions } from '../components/cellar-limit-modal/cellar-limit-modal';
import { WorkspaceContextService } from './workspace-context.service';

/** One offer for both proactive capacity checks and authoritative API rejections. */
@Injectable({ providedIn: 'root' })
export class CellarLimitService {
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  open(spaceId?: string, options?: SpaceLimitModalOptions): boolean {
    const workspace = this.injector.get(WorkspaceContextService);
    const id = spaceId ?? workspace.selection().space?.id.value;
    const space = workspace.spaces().find(item => item.id.value === id);
    if (!space) return false;
    if (this.dialog.openDialogs.some(ref => ref.componentInstance instanceof CellarLimitModalComponent)) return true;
    const data: SpaceLimitModalData = { ...space, ...options };
    this.dialog.open(CellarLimitModalComponent, {
      width: '580px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog',
      ariaLabelledBy: 'cellar-limit-title', ariaDescribedBy: 'cellar-limit-description', data,
    });
    return true;
  }
}
