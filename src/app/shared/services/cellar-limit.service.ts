import { Injectable, Injector, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CellarLimitModalComponent } from '../components/cellar-limit-modal/cellar-limit-modal';
import { WorkspaceContextService } from './workspace-context.service';

/** One offer for both proactive capacity checks and authoritative API rejections. */
@Injectable({ providedIn: 'root' })
export class CellarLimitService {
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  open(spaceId?: string): void {
    const workspace = this.injector.get(WorkspaceContextService);
    const id = spaceId ?? workspace.selection().space?.id.value;
    const space = workspace.spaces().find(item => item.id.value === id);
    if (!space || this.dialog.openDialogs.some(ref => ref.componentInstance instanceof CellarLimitModalComponent)) return;
    this.dialog.open(CellarLimitModalComponent, {
      width: '580px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog',
      ariaLabelledBy: 'cellar-limit-title', ariaDescribedBy: 'cellar-limit-description', data: space,
    });
  }
}
