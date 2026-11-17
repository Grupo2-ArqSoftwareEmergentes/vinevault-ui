import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { WorkspaceSpace } from '../../models/workspace-context';

@Component({
  selector: 'app-cellar-limit-modal', standalone: true,
  imports: [MatDialogModule, RouterLink],
  templateUrl: './cellar-limit-modal.html', styleUrl: './cellar-limit-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellarLimitModalComponent {
  readonly space = inject<WorkspaceSpace>(MAT_DIALOG_DATA);
}
