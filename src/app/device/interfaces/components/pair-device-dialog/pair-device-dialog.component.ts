import { I18nModule } from '../../../../core/i18n/i18n.module';
import { Component, DestroyRef, Injector, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellar } from '../../../../cava/domain/services/wine-cellar-query-service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { Subscription, finalize, takeUntil } from 'rxjs';

export type PairDeviceDialogResult = Readonly<{
  hardwareId: string;
  cellarId?: string;
}>;

export interface PairDeviceDialogData { spaceId: string; }

@Component({
  selector: 'app-pair-device-dialog',
  standalone: true,
  imports: [I18nModule, CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './pair-device-dialog.component.html',
  styleUrls: ['./pair-device-dialog.component.css', '../../styles/device-management-dialog.css'],
})
export class PairDeviceDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PairDeviceDialogComponent, PairDeviceDialogResult | undefined>);
  private readonly fb = inject(FormBuilder);
  readonly data = inject<PairDeviceDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(WorkspaceScopeService);
  private request?: Subscription;
  readonly cellars = signal<readonly WineCellar[]>([]);
  readonly loadingCellars = signal(false);
  readonly cellarError = signal(false);

  form: FormGroup = this.fb.group({
    hardwareId: ['', [Validators.required, Validators.pattern(/^VINE-[0-9A-Za-z]{4}$/)]],
    cellarId: [''],
  });

  ngOnInit(): void {
    if (this.data?.spaceId) this.loadCellars();
    this.scope.changed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cancel());
  }

  loadCellars(): void {
    if (!this.data?.spaceId) return;
    const spaceId = this.data.spaceId;
    this.request?.unsubscribe();
    this.loadingCellars.set(true); this.cellarError.set(false);
    this.request = this.injector.get(WineCellarQueryServiceImpl).getWineCellarsBySpace(spaceId).pipe(
      finalize(() => this.loadingCellars.set(false)),
      takeUntil(this.scope.changed), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: cellars => this.cellars.set(cellars.filter(cellar => cellar.spaceId.value === spaceId)),
      error: () => this.cellarError.set(true),
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    const cellarId = this.form.value.cellarId as string;
    if (cellarId && !this.cellars().some(cellar => cellar.id.value === cellarId && !cellar.deviceId)) {
      this.form.get('cellarId')?.setErrors({ unavailable: true }); return;
    }
    this.dialogRef.close({
      hardwareId: this.form.value.hardwareId as string,
      ...(cellarId ? { cellarId } : {}),
    });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
