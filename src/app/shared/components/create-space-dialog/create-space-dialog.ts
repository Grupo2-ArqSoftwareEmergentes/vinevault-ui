import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, InjectionToken, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize } from 'rxjs';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { workspaceErrorMessage } from '../../services/workspace-api.service';
import { SpaceType } from '../../../device/domain/model/valueobjects/space-access';
import { canCreateSpace } from '../../services/workspace-quota';

/** Informational placeholder only; override with a confirmed monthly display price. */
export const EXTRA_SPACE_MONTHLY_PRICE = new InjectionToken<string>('EXTRA_SPACE_MONTHLY_PRICE', {
  providedIn: 'root', factory: () => '$X.XX',
});

@Component({
  selector: 'app-create-space-dialog', standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './create-space-dialog.html', styleUrl: './create-space-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateSpaceDialogComponent {
  readonly dialogRef = inject(MatDialogRef<CreateSpaceDialogComponent>);
  readonly workspace = inject(WorkspaceContextService);
  readonly monthlyPrice = inject(EXTRA_SPACE_MONTHLY_PRICE);
  readonly quotaExhausted = computed(() => {
    const quota = this.workspace.accountQuota();
    return !!quota && (quota.remaining_spaces === 0 || (!quota.can_create_collector && !quota.can_create_business));
  });
  readonly paymentNotice = signal(false);
  canCreate(purpose: SpaceType): boolean { return canCreateSpace(this.workspace.accountQuota(), purpose); }
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  name = '';
  spaceType: SpaceType | null = null;
  saving = false;
  error = '';

  constructor() {
    effect(() => { if (!this.quotaExhausted()) this.paymentNotice.set(false); });
  }

  acquireExtraSpace(): void {
    if (this.saving || !this.quotaExhausted()) return;
    this.paymentNotice.set(true);
  }

  submit(): void {
    const name = this.name.trim();
    const purpose = this.spaceType;
    if (!name || !purpose || this.saving || this.quotaExhausted() || !this.canCreate(purpose)) return;
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
