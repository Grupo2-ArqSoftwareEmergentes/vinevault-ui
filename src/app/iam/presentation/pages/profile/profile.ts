import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { ProfileService } from '../../../data/services/profile.service';
import {
  PreferredLanguage,
  SUPPORTED_LANGUAGES,
  UpdateProfilePayload,
  UserProfile,
  userInitialsFrom,
  utf8ByteLength,
} from '../../../domain/models/profile';
import { apiErrorDetail } from '../../../../shared/services/workspace-quota';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';

function trimmedMinLength(min: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const trimmed = String(control.value ?? '').trim();
    if (!trimmed) return null;
    return trimmed.length < min ? { trimmedMinLength: { requiredLength: min, actualLength: trimmed.length } } : null;
  };
}

function trimmedMaxLength(max: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const trimmed = String(control.value ?? '').trim();
    return trimmed.length > max ? { trimmedMaxLength: { requiredLength: max, actualLength: trimmed.length } } : null;
  };
}

function alphanumericUsername(control: AbstractControl<string>): ValidationErrors | null {
  const trimmed = String(control.value ?? '').trim();
  if (!trimmed) return null;
  return /^[A-Za-z0-9]+$/.test(trimmed) ? null : { alphanumeric: true };
}

function utf8MaxBytes(maxBytes: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) return null;
    const bytes = utf8ByteLength(value);
    return bytes > maxBytes ? { maxUtf8Bytes: { maxBytes, actualBytes: bytes } } : null;
  };
}

function passwordGroupValidator(group: AbstractControl): ValidationErrors | null {
  const current = String(group.get('current_password')?.value ?? '');
  const next = String(group.get('new_password')?.value ?? '');
  const confirm = String(group.get('confirm_password')?.value ?? '');
  const errors: ValidationErrors = {};
  if (next && confirm && next !== confirm) errors['passwordMismatch'] = true;
  if (current && next && current === next) errors['passwordUnchanged'] = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, HeaderComponent, SidebarComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly loadedProfile = signal<UserProfile | null>(null);
  readonly loadingProfile = signal(false);
  readonly loadError = signal('');

  readonly savingProfile = signal(false);
  readonly profileSuccess = signal('');
  readonly profileError = signal('');

  readonly savingPassword = signal(false);
  readonly passwordSuccess = signal('');
  readonly passwordSecurityNotice = signal('');
  readonly passwordError = signal('');

  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly formVersion = signal(0);
  isSidebarOpen = window.innerWidth > 768;

  readonly profileForm = this.fb.group({
    full_name: this.fb.control('', [trimmedMaxLength(255)]),
    username: this.fb.control('', [Validators.required, trimmedMinLength(3), trimmedMaxLength(50), alphanumericUsername]),
    email: this.fb.control('', [Validators.required, Validators.email, trimmedMaxLength(100)]),
    preferred_language: this.fb.control<PreferredLanguage>('es', [Validators.required]),
  });

  readonly passwordForm = this.fb.group(
    {
      current_password: this.fb.control('', [Validators.required]),
      new_password: this.fb.control('', [Validators.required, Validators.minLength(6), utf8MaxBytes(72)]),
      confirm_password: this.fb.control('', [Validators.required]),
    },
    { validators: [passwordGroupValidator] }
  );

  readonly initials = computed(() => {
    const p = this.loadedProfile();
    return userInitialsFrom(p?.full_name, p?.username, p?.email);
  });

  readonly hasProfileChanges = computed(() => {
    this.formVersion();
    return Object.keys(this.buildProfilePatch()).length > 0;
  });

  ngOnInit(): void {
    this.profileForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formVersion.update((v) => v + 1);
      if (this.profileSuccess()) this.profileSuccess.set('');
      if (this.profileError()) this.profileError.set('');
    });

    this.passwordForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.passwordSuccess()) this.passwordSuccess.set('');
      if (this.passwordSecurityNotice()) this.passwordSecurityNotice.set('');
      if (this.passwordError()) this.passwordError.set('');
    });

    this.loadProfile();
  }

  toggleSidebar(): void { this.isSidebarOpen = !this.isSidebarOpen; }
  closeSidebar(): void { this.isSidebarOpen = false; }

  loadProfile(): void {
    if (this.loadingProfile()) return;
    this.loadingProfile.set(true);
    this.loadError.set('');
    this.profileService.getProfile().pipe(
      finalize(() => this.loadingProfile.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (profile) => this.applyLoadedProfile(profile),
      error: (error: unknown) => {
        this.loadError.set(this.mapProfileError(error, 'No se pudo cargar tu perfil. Inténtalo de nuevo.'));
      },
    });
  }

  saveProfile(): void {
    if (this.savingProfile() || this.loadingProfile() || !this.loadedProfile()) return;
    this.profileForm.markAllAsTouched();
    this.profileSuccess.set('');
    this.profileError.set('');

    if (this.profileForm.invalid) return;

    const patch = this.buildProfilePatch();
    if (!Object.keys(patch).length) return;

    this.savingProfile.set(true);
    this.profileService.updateProfile(patch).pipe(
      finalize(() => this.savingProfile.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this.applyLoadedProfile(updated);
        this.profileSuccess.set('Cambios guardados. Tu perfil y preferencia de idioma se han actualizado.');
      },
      error: (error: unknown) => {
        this.profileError.set(this.mapProfileError(error, 'No pudimos guardar los cambios de tu perfil. Revisa los datos e inténtalo de nuevo.'));
      },
    });
  }

  savePassword(): void {
    if (this.savingPassword()) return;
    this.passwordForm.markAllAsTouched();
    this.passwordSuccess.set('');
    this.passwordSecurityNotice.set('');
    this.passwordError.set('');

    if (this.passwordForm.invalid) return;

    const { current_password, new_password } = this.passwordForm.getRawValue();
    this.savingPassword.set(true);
    this.profileService.changePassword({ current_password, new_password }).pipe(
      finalize(() => this.savingPassword.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.passwordForm.reset({ current_password: '', new_password: '', confirm_password: '' }, { emitEvent: false });
        this.passwordForm.markAsPristine();
        this.passwordForm.markAsUntouched();
        this.showCurrentPassword.set(false);
        this.showNewPassword.set(false);
        this.showConfirmPassword.set(false);
        this.passwordSuccess.set(response?.message?.trim() || 'Contraseña actualizada correctamente.');
        this.passwordSecurityNotice.set(
          response?.security_notice?.trim() || 'Tu sesión actual permanece activa en este dispositivo.'
        );
      },
      error: (error: unknown) => {
        this.passwordError.set(this.mapPasswordError(error));
      },
    });
  }

  private applyLoadedProfile(profile: UserProfile): void {
    this.loadedProfile.set(profile);
    this.profileForm.reset(
      {
        full_name: profile.full_name ?? '',
        username: profile.username,
        email: profile.email,
        preferred_language: profile.preferred_language,
      },
      { emitEvent: false }
    );
    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
    this.formVersion.update((v) => v + 1);
  }

  private buildProfilePatch(): UpdateProfilePayload {
    const loaded = this.loadedProfile();
    if (!loaded) return {};
    const raw = this.profileForm.getRawValue();
    const patch: UpdateProfilePayload = {};

    const nextUsername = raw.username.trim();
    if (nextUsername !== loaded.username) patch.username = nextUsername;

    const nextEmail = raw.email.trim().toLowerCase();
    if (nextEmail !== loaded.email.toLowerCase()) patch.email = nextEmail;

    const nextFullName = raw.full_name.trim();
    const prevFullName = (loaded.full_name ?? '').trim();
    if (nextFullName !== prevFullName) patch.full_name = nextFullName;

    if (raw.preferred_language !== loaded.preferred_language) {
      patch.preferred_language = raw.preferred_language;
    }
    return patch;
  }

  private mapProfileError(error: unknown, fallback: string): string {
    const detail = apiErrorDetail(error);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
      if (error.status === 409) {
        if (detail?.code === 'USERNAME_TAKEN') return detail.message || 'Ese nombre de usuario ya está registrado en otra cuenta.';
        if (detail?.code === 'EMAIL_TAKEN') return detail.message || 'Ese correo electrónico ya está registrado en otra cuenta.';
        return detail?.message || extractApiErrorMessage(error, 'El correo o nombre de usuario ya está en uso.');
      }
      if (error.status === 400 || error.status === 422) {
        if (detail?.code === 'EMPTY_UPDATE') return detail.message || 'No hay cambios nuevos para actualizar.';
        return detail?.message || extractApiErrorMessage(error, 'Revisa los campos del formulario e inténtalo de nuevo.');
      }
    }
    return extractApiErrorMessage(error, fallback);
  }

  private mapPasswordError(error: unknown): string {
    const detail = apiErrorDetail(error);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
      if (error.status === 401) {
        if (detail?.code === 'INVALID_CURRENT_PASSWORD') {
          return detail.message || 'La contraseña actual es incorrecta.';
        }
        return detail?.message || 'Tu sesión no es válida. Inicia sesión nuevamente.';
      }
      if (error.status === 400 || error.status === 422) {
        if (detail?.code === 'PASSWORD_UNCHANGED') {
          return detail.message || 'La nueva contraseña debe ser diferente a la contraseña actual.';
        }
        if (detail?.code === 'INVALID_PASSWORD_POLICY') {
          return detail.message || 'La nueva contraseña debe tener al menos 6 caracteres y como máximo 72 bytes UTF-8.';
        }
        return detail?.message || extractApiErrorMessage(error, 'No se pudo validar el cambio de contraseña.');
      }
    }
    return extractApiErrorMessage(error, 'No pudimos actualizar tu contraseña. Inténtalo de nuevo.');
  }
}
