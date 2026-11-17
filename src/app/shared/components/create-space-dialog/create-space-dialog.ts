import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize } from 'rxjs';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { workspaceErrorMessage } from '../../services/workspace-api.service';
import { SpaceType } from '../../../device/domain/model/valueobjects/space-access';
import { canCreateSpace } from '../../services/workspace-quota';

@Component({
  selector: 'app-create-space-dialog', standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './create-space-dialog.html', styleUrl: './create-space-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateSpaceDialogComponent {
  readonly dialogRef = inject(MatDialogRef<CreateSpaceDialogComponent>);
  readonly workspace = inject(WorkspaceContextService);
  canCreate(purpose: SpaceType): boolean { return canCreateSpace(this.workspace.accountQuota(), purpose); }
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  name = '';
  spaceType: SpaceType | null = null;
  saving = false;
  error = '';

  submit(): void {
    const name = this.name.trim();
    const purpose = this.spaceType;
    if (!name || !purpose || this.saving || !this.canCreate(purpose)) return;
    this.saving = true;
    this.error = '';
    this.dialogRef.disableClose = true;
    defer(() => this.workspace.createSpace(name, purpose)).pipe(
      finalize(() => {
        this.saving = false;
        this.dialogRef.disableClose = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => this.dialogRef.close(created),
      error: (error: unknown) => {
        this.error = workspaceErrorMessage(error, 'Unable to create this space. Please retry.');
        this.cdr.markForCheck();
      },
    });
  }
}
