import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { finalize, take } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { ProfileService } from '../../../data/services/profile.service';
import {
  PreferredLanguage,
  SUPPORTED_LANGUAGES,
  UserProfile,
} from '../../../domain/models/profile';
import { apiErrorDetail } from '../../../../shared/services/workspace-quota';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { EditProfileDialogComponent } from '../../components/edit-profile-dialog/edit-profile-dialog';
import {
  ChangePasswordDialogComponent,
  ChangePasswordDialogResult,
} from '../../components/change-password-dialog/change-password-dialog';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';

const BURGUNDY_DIALOG_CONFIG = {
  width: '520px',
  maxWidth: 'calc(100vw - 32px)',
  panelClass: 'profile-burgundy-dialog',
  backdropClass: 'profile-burgundy-backdrop',
} as const;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, HeaderComponent, SidebarComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  readonly workspace = inject(WorkspaceContextService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly loadedProfile = signal<UserProfile | null>(null);
  readonly loadingProfile = signal(false);
  readonly loadError = signal('');

  readonly accountFeedback = signal('');
  readonly accountSecurityNotice = signal('');

  readonly savingLanguage = signal(false);
  readonly languageFeedback = signal('');
  readonly languageError = signal('');


  isSidebarOpen = window.innerWidth > 768;

  readonly activeLanguage = computed<PreferredLanguage>(() =>
    this.loadedProfile()?.preferred_language ?? this.profileService.preferredLanguage()
  );

  ngOnInit(): void {
    this.workspace.ensureLoaded();
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
      next: (profile) => this.loadedProfile.set(profile),
      error: (error: unknown) => {
        this.loadError.set(this.mapError(error, 'No se pudo cargar tu perfil. Inténtalo de nuevo.'));
      },
    });
  }

  openEditProfileModal(): void {
    const profile = this.loadedProfile();
    if (!profile || this.dialog.openDialogs.some((d) => d.componentInstance instanceof EditProfileDialogComponent)) return;
    this.accountFeedback.set('');
    this.accountSecurityNotice.set('');

    this.dialog.open<EditProfileDialogComponent, UserProfile, UserProfile | undefined>(EditProfileDialogComponent, {
      ...BURGUNDY_DIALOG_CONFIG,
      ariaLabelledBy: 'edit-profile-title',
      data: profile,
    }).afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
      if (!updated) return;
      this.loadedProfile.set(updated);
      this.accountFeedback.set('Datos personales actualizados correctamente.');
    });
  }

  openChangePasswordModal(): void {
    if (this.dialog.openDialogs.some((d) => d.componentInstance instanceof ChangePasswordDialogComponent)) return;
    this.accountFeedback.set('');
    this.accountSecurityNotice.set('');

    this.dialog.open<ChangePasswordDialogComponent, undefined, ChangePasswordDialogResult | undefined>(ChangePasswordDialogComponent, {
      ...BURGUNDY_DIALOG_CONFIG,
      ariaLabelledBy: 'change-password-title',
    }).afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result) return;
      this.accountFeedback.set(result.message);
      this.accountSecurityNotice.set(result.securityNotice);
    });
  }

  selectLanguage(language: PreferredLanguage): void {
    if (this.savingLanguage() || this.loadingProfile() || !this.loadedProfile() || this.activeLanguage() === language) {
      return;
    }
    this.savingLanguage.set(true);
    this.languageFeedback.set('');
    this.languageError.set('');

    this.profileService.updateProfile({ preferred_language: language }).pipe(
      finalize(() => this.savingLanguage.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        this.loadedProfile.set(updated);
        const label = this.languages.find((l) => l.code === updated.preferred_language)?.label ?? updated.preferred_language;
        this.languageFeedback.set(`Idioma actualizado a ${label}.`);
      },
      error: (error: unknown) => {
        this.languageError.set(this.mapError(error, 'No se pudo actualizar el idioma preferido. Inténtalo de nuevo.'));
      },
    });
  }

  private mapError(error: unknown, fallback: string): string {
    const detail = apiErrorDetail(error);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
      if (error.status === 400 || error.status === 422) {
        return detail?.message || extractApiErrorMessage(error, fallback);
      }
    }
    return extractApiErrorMessage(error, fallback);
  }
}
