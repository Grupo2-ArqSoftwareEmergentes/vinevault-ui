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
  userInitialsFrom,
} from '../../../domain/models/profile';
import { apiErrorDetail } from '../../../../shared/services/workspace-quota';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { EditProfileDialogComponent } from '../../components/edit-profile-dialog/edit-profile-dialog';
import {
  ChangePasswordDialogComponent,
  ChangePasswordDialogResult,
} from '../../components/change-password-dialog/change-password-dialog';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { SubscriptionApiService } from '../../../../shared/services/subscription-api.service';
import {
  SubscriptionRequestRecord,
  formatQuotedMonthly,
} from '../../../../shared/models/subscription';

export type AccountSubscriptionBadge = 'active' | 'pending' | 'free' | 'expired';

export interface AccountSubscriptionItem {
  id: string;
  title: string;
  scopeLabel: string;
  roleLabel?: string;
  statusLabel: 'Activa' | 'Pendiente' | 'Gratuita' | 'Expirada';
  badge: AccountSubscriptionBadge;
  validityLabel: string;
  manageSpaceId?: string;
}

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
  private readonly subscriptionsApi = inject(SubscriptionApiService);
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

  readonly pendingRequests = signal<readonly SubscriptionRequestRecord[]>([]);
  readonly loadingSubscriptions = signal(false);
  readonly subscriptionsError = signal('');

  isSidebarOpen = window.innerWidth > 768;

  readonly initials = computed(() => {
    const p = this.loadedProfile();
    return userInitialsFrom(p?.full_name, p?.username, p?.email);
  });

  readonly activeLanguage = computed<PreferredLanguage>(() =>
    this.loadedProfile()?.preferred_language ?? this.profileService.preferredLanguage()
  );

  readonly subscriptionItems = computed<readonly AccountSubscriptionItem[]>(() => {
    const items: AccountSubscriptionItem[] = [];
    const spaces = this.workspace.spaces();
    const sortedSpaces = [...spaces].sort((a, b) => {
      const rank = (plan: string | null | undefined) => (plan === 'PRO' ? 0 : 1);
      return rank(a.subscriptionPlan) - rank(b.subscriptionPlan);
    });

    for (const space of sortedSpaces) {
      const purposeLabel = space.spaceType === 'BUSINESS' ? 'Business' : space.spaceType === 'COLLECTOR' ? 'Collector' : 'Espacio';
      const isPro = space.subscriptionPlan === 'PRO';
      const isExpired = isPro && space.subscriptionStatus === 'EXPIRED';
      const planTitle = isPro ? `VineVault ${purposeLabel} Pro` : `VineVault ${purposeLabel} Free`;
      const formattedExpiry = this.formatOptionalDate(space.subscriptionExpiresAt);

      let statusLabel: AccountSubscriptionItem['statusLabel'] = 'Gratuita';
      let badge: AccountSubscriptionBadge = 'free';
      let validityLabel = 'Sin vencimiento · Plan gratuito';

      if (isPro && !isExpired) {
        statusLabel = 'Activa';
        badge = 'active';
        validityLabel = formattedExpiry
          ? `Vigente hasta ${formattedExpiry}`
          : 'Activa · Renovación gestionada por el servidor';
      } else if (isExpired) {
        statusLabel = 'Expirada';
        badge = 'expired';
        validityLabel = formattedExpiry
          ? `Expiró el ${formattedExpiry}`
          : 'Suscripción expirada · Revisa su estado en Planes';
      }

      items.push({
        id: `space-${space.id.value}`,
        title: planTitle,
        scopeLabel: `Espacio: ${space.name}`,
        roleLabel: space.role ?? undefined,
        statusLabel,
        badge,
        validityLabel,
        manageSpaceId: space.id.value,
      });
    }

    const extraSlots = this.workspace.accountQuota()?.extra_spaces_allowance ?? 0;
    if (extraSlots > 0) {
      items.push({
        id: 'addon-extra-spaces',
        title: `Espacios adicionales (+${extraSlots})`,
        scopeLabel: 'Nivel cuenta · Add-on EXTRA_SPACE',
        statusLabel: 'Activa',
        badge: 'active',
        validityLabel: 'Activa en tu cuenta · Vigencia gestionada por el servidor',
      });
    }

    for (const req of this.pendingRequests()) {
      if (req.status !== 'PENDING_PAYMENT') continue;
      const spaceName = req.space_id
        ? spaces.find((s) => s.id.value === req.space_id)?.name ?? `Espacio ${req.space_id}`
        : null;
      const formattedExpiry = this.formatOptionalDate(req.valid_until);
      const quote = formatQuotedMonthly(req.total_amount, req.currency);

      items.push({
        id: `request-${req.id}`,
        title: req.kind === 'UPGRADE_PRO'
          ? 'Solicitud de Upgrade a Pro'
          : `Solicitud de Espacio Adicional${req.quantity > 1 ? ` (×${req.quantity})` : ''}`,
        scopeLabel: spaceName ? `Espacio: ${spaceName}` : 'Nivel cuenta · Add-on EXTRA_SPACE',
        statusLabel: 'Pendiente',
        badge: 'pending',
        validityLabel: formattedExpiry
          ? `Pendiente de pago (${quote}) · Vigencia estimada hasta ${formattedExpiry}`
          : `Pendiente de confirmación de pago · ${quote}`,
        manageSpaceId: req.space_id ?? undefined,
      });
    }

    return items;
  });

  ngOnInit(): void {
    this.workspace.ensureLoaded();
    this.loadProfile();
    this.loadSubscriptions();
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

  loadSubscriptions(): void {
    if (this.loadingSubscriptions()) return;
    this.loadingSubscriptions.set(true);
    this.subscriptionsError.set('');
    this.subscriptionsApi.getRequests(20, 0).pipe(
      finalize(() => this.loadingSubscriptions.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (page) => this.pendingRequests.set(page.items),
      error: () => {
        this.subscriptionsError.set('No pudimos consultar las solicitudes pendientes en este momento.');
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

  private formatOptionalDate(isoDate: string | null | undefined): string | null {
    if (!isoDate || typeof isoDate !== 'string') return null;
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(this.activeLanguage() === 'en' ? 'en-US' : 'es-PE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(parsed);
    } catch {
      return isoDate.slice(0, 10);
    }
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
