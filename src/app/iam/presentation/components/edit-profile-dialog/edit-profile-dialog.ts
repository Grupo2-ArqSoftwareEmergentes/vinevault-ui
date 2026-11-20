import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ProfileService } from '../../../data/services/profile.service';
import { UpdateProfilePayload, UserProfile } from '../../../domain/models/profile';
import { apiErrorDetail } from '../../../../shared/services/workspace-quota';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { alphanumericUsername, trimmedMaxLength, trimmedMinLength } from '../../pages/profile/profile-validators';

@Component({
  selector: 'app-edit-profile-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule],
  templateUrl: './edit-profile-dialog.html',
  styleUrl: './edit-profile-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfileDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly dialogRef = inject(MatDialogRef<EditProfileDialogComponent, UserProfile | undefined>);
  readonly data = inject<UserProfile>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly error = signal('');
  private readonly formVersion = signal(0);

  readonly form = this.fb.group({
    full_name: this.fb.control(this.data.full_name ?? '', [trimmedMaxLength(255)]),
    username: this.fb.control(this.data.username, [Validators.required, trimmedMinLength(3), trimmedMaxLength(50), alphanumericUsername]),
    email: this.fb.control(this.data.email, [Validators.required, Validators.email, trimmedMaxLength(100)]),
  });

  readonly hasChanges = computed(() => {
    this.formVersion();
    return Object.keys(this.buildPatch()).length > 0;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formVersion.update((v) => v + 1);
      if (this.error()) this.error.set('');
    });
  }

  submit(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;

    const patch = this.buildPatch();
    if (!Object.keys(patch).length) return;

    this.saving.set(true);
    this.dialogRef.disableClose = true;

    this.profileService.updateProfile(patch).pipe(
      finalize(() => {
        this.saving.set(false);
        this.dialogRef.disableClose = false;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => this.dialogRef.close(updated),
      error: (err: unknown) => this.error.set(this.mapError(err)),
    });
  }

  private buildPatch(): UpdateProfilePayload {
    const raw = this.form.getRawValue();
    const patch: UpdateProfilePayload = {};

    const nextUsername = raw.username.trim();
    if (nextUsername !== this.data.username) patch.username = nextUsername;

    const nextEmail = raw.email.trim().toLowerCase();
    if (nextEmail !== this.data.email.toLowerCase()) patch.email = nextEmail;

    const nextFullName = raw.full_name.trim();
    const prevFullName = (this.data.full_name ?? '').trim();
    if (nextFullName !== prevFullName) patch.full_name = nextFullName;

    return patch;
  }

  private mapError(error: unknown): string {
    const detail = apiErrorDetail(error);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
      if (error.status === 409) {
        if (detail?.code === 'USERNAME_TAKEN') return detail.message || 'Ese nombre de usuario ya está registrado en otra cuenta.';
        if (detail?.code === 'EMAIL_TAKEN') return detail.message || 'Ese correo electrónico ya está registrado en otra cuenta.';
        return detail?.message || extractApiErrorMessage(error, 'El correo o nombre de usuario ya está en uso.');
      }
      if (error.status === 400 || error.status === 422) {
        return detail?.message || extractApiErrorMessage(error, 'Revisa los campos e inténtalo de nuevo.');
      }
    }
    return extractApiErrorMessage(error, 'No pudimos guardar los cambios. Inténtalo de nuevo.');
  }
}
