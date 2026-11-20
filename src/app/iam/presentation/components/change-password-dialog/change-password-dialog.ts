import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ProfileService } from '../../../data/services/profile.service';
import { apiErrorDetail } from '../../../../shared/services/workspace-quota';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { passwordGroupValidator, utf8MaxBytes } from '../../pages/profile/profile-validators';

export interface ChangePasswordDialogResult {
  message: string;
  securityNotice: string;
}

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule],
  templateUrl: './change-password-dialog.html',
  styleUrl: './change-password-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent, ChangePasswordDialogResult | undefined>);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly error = signal('');
  readonly showCurrent = signal(false);
  readonly showNew = signal(false);
  readonly showConfirm = signal(false);

  readonly form = this.fb.group(
    {
      current_password: this.fb.control('', [Validators.required]),
      new_password: this.fb.control('', [Validators.required, Validators.minLength(6), utf8MaxBytes(72)]),
      confirm_password: this.fb.control('', [Validators.required]),
    },
    { validators: [passwordGroupValidator] }
  );

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.error()) this.error.set('');
    });
  }

  submit(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;

    const { current_password, new_password } = this.form.getRawValue();
    this.saving.set(true);
    this.dialogRef.disableClose = true;

    this.profileService.changePassword({ current_password, new_password }).pipe(
      finalize(() => {
        this.saving.set(false);
        this.dialogRef.disableClose = false;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.form.reset({ current_password: '', new_password: '', confirm_password: '' }, { emitEvent: false });
        this.dialogRef.close({
          message: response?.message?.trim() || 'Contraseña actualizada correctamente.',
          securityNotice: response?.security_notice?.trim() || 'Tu sesión actual permanece activa en este dispositivo.',
        });
      },
      error: (err: unknown) => this.error.set(this.mapError(err)),
    });
  }

  private mapError(error: unknown): string {
    const detail = apiErrorDetail(error);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
      if (error.status === 401) {
        if (detail?.code === 'INVALID_CURRENT_PASSWORD') return detail.message || 'La contraseña actual es incorrecta.';
        return detail?.message || 'Tu sesión no es válida. Inicia sesión nuevamente.';
      }
      if (error.status === 400 || error.status === 422) {
        if (detail?.code === 'PASSWORD_UNCHANGED') return detail.message || 'La nueva contraseña debe ser diferente a la contraseña actual.';
        if (detail?.code === 'INVALID_PASSWORD_POLICY') return detail.message || 'La nueva contraseña debe tener al menos 6 caracteres y máximo 72 bytes UTF-8.';
        return detail?.message || extractApiErrorMessage(error, 'No se pudo validar el cambio de contraseña.');
      }
    }
    return extractApiErrorMessage(error, 'No pudimos actualizar tu contraseña. Inténtalo de nuevo.');
  }
}
