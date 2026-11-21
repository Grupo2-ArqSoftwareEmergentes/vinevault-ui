import { I18nModule } from '../../../../core/i18n/i18n.module';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { StockMovementService, stockMovementError } from '../../../application/internal/commandservices/stock-movement.service';
import { StockExitReason, StockMovement } from '../../../domain/model/stock-movement';
import { WineInventoryItem } from '../../../domain/services/wine-inventory-item-query-service';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';

export interface StockMovementDialogData {
  item: WineInventoryItem;
  spaceId: string;
  mode: 'exit' | 'history';
}

@Component({
  selector: 'app-stock-movement-dialog', standalone: true,
  imports: [I18nModule, CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './stock-movement-dialog.html', styleUrl: './stock-movement-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockMovementDialogComponent implements OnInit {
  readonly data: StockMovementDialogData = inject(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<StockMovementDialogComponent>);
  readonly access = inject(WorkspaceAccessService);
  private readonly service = inject(StockMovementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly form = new FormGroup({
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(2147483647), Validators.pattern(/^\d+$/)] }),
    reason: new FormControl<StockExitReason>('uncorking', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });
  movements: readonly StockMovement[] = [];
  loading = false;
  saving = false;
  error = '';
  historyError = '';
  // An uncertain response must not invite a blind second POST in the same dialog.
  attempted = false;
  get sameSpace(): boolean { return this.access.space()?.id.value === this.data.spaceId; }
  get canWrite(): boolean { return this.sameSpace && this.access.canInventory(); }

  ngOnInit(): void { this.loadHistory(); }

  loadHistory(): void {
    if (!this.sameSpace || this.loading) return;
    this.loading = true;
    this.historyError = '';
    this.service.list(this.data.item.wineCellarId.value, this.data.item.id.value).pipe(
      finalize(() => { this.loading = false; this.cdr.markForCheck(); }), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (items) => { if (this.sameSpace) this.movements = items; },
      error: (error: unknown) => { this.historyError = stockMovementError(error); },
    });
  }

  submit(): void {
    if (this.saving || this.attempted || this.form.invalid || !this.canWrite || this.data.mode !== 'exit') return;
    const value = this.form.getRawValue();
    if (!['sale', 'tasting', 'breakage', 'uncorking'].includes(value.reason)) return;
    this.saving = true;
    this.attempted = true;
    this.dialogRef.disableClose = true;
    this.form.disable();
    this.service.create(this.data.item.wineCellarId.value, this.data.item.id.value, {
      quantity: value.quantity, reason: value.reason, notes: value.notes.trim() || null,
    }).pipe(
      finalize(() => { this.saving = false; this.dialogRef.disableClose = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (movement) => this.dialogRef.close(movement),
      error: (error: unknown) => { this.error = stockMovementError(error); },
    });
  }
}
