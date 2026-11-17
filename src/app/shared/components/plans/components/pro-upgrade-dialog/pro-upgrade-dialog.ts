import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { WorkspaceAccessService } from '../../../../services/workspace-access.service';
import { proBenefits } from '../pro-benefits';

@Component({
  selector: 'app-pro-upgrade-dialog', standalone: true, imports: [CommonModule, MatDialogModule],
  templateUrl: './pro-upgrade-dialog.html', styleUrl: './pro-upgrade-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProUpgradeDialogComponent {
  readonly access = inject(WorkspaceAccessService);
  readonly data = inject<{ spaceId: string }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProUpgradeDialogComponent>);
  readonly benefits = proBenefits;

  constructor() {
    // Never leave an offer attached to another Topbar context or an already changed plan.
    effect(() => {
      if (this.access.space()?.id.value !== this.data.spaceId || this.access.plan() !== 'FREE') this.dialogRef.close();
    });
  }
}
