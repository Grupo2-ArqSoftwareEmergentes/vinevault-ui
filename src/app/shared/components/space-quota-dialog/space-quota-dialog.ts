import { I18nModule } from '../../../core/i18n/i18n.module';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { SpaceQuotas } from '../../models/workspace-context';

@Component({
  selector: 'app-space-quota-dialog', standalone: true, imports: [I18nModule, MatDialogModule],
  templateUrl: './space-quota-dialog.html', styleUrl: './space-quota-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceQuotaDialogComponent {
  readonly workspace = inject(WorkspaceContextService);
  private readonly data = inject<{ spaceId: string }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SpaceQuotaDialogComponent>);
  readonly fields: readonly { key: keyof SpaceQuotas; label: string }[] = [
    { key: 'cellars', label: 'Cavas' }, { key: 'bottles', label: 'Botellas' }, { key: 'skus', label: 'SKUs' },
  ];

  constructor() {
    effect(() => { if (this.workspace.selection().space?.id.value !== this.data.spaceId) this.dialogRef.close(); });
  }
}
