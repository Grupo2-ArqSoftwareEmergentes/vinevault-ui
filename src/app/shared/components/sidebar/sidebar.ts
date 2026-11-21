import { I18nModule } from '../../../core/i18n/i18n.module';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { LogoutUseCase } from '../../../iam/domain/use-cases/logout/logout';
import { AuthStateService } from '../../../iam/presentation/state/auth-state/auth-state';
import { ProfileService } from '../../../iam/data/services/profile.service';
import { userInitialsFrom } from '../../../iam/domain/models/profile';
import { I18nService } from '../../../core/i18n/i18n.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [I18nModule, CommonModule, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class SidebarComponent {
  @Input() isOpen = true;
  @Output() closeRequested = new EventEmitter<void>();

  private readonly authState = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private readonly i18n = inject(I18nService);
  private readonly authSnapshot = toSignal(this.authState.getState(), { initialValue: this.authState.getCurrentState() });

  readonly navItems: NavItem[] = [
    { label: 'Overview', icon: 'dashboard', route: '/overview', exact: true },
    { label: 'Inventory', icon: 'inventory', route: '/inventory', exact: true },
    { label: 'Devices', icon: 'sensors', route: '/devices', exact: true },
    { label: 'Alerts', icon: 'notifications_active', route: '/alerts', exact: true },
  ];

  readonly displayUsername = computed(() => {
    const profile = this.profileService.profile();
    const authUser = this.authSnapshot().user;
    return (profile?.username ?? authUser?.username ?? '').trim();
  });

  readonly userInitials = computed(() => {
    const profile = this.profileService.profile();
    const authUser = this.authSnapshot().user;
    return userInitialsFrom(
      profile?.full_name ?? authUser?.full_name,
      profile?.username ?? authUser?.username,
      profile?.email ?? authUser?.email
    );
  });

  readonly profileTooltip = computed(() => {
    const username = this.displayUsername();
    return username ? `${this.i18n.t('Cuenta')} · ${username}` : this.i18n.t('Cuenta');
  });

  constructor(
    private readonly logoutUseCase: LogoutUseCase,
    private readonly router: Router,
  ) {}

  onNavItemClick(): void {
    if (window.innerWidth <= 768) {
      this.closeRequested.emit();
    }
  }

  onLogout(): void {
    this.logoutUseCase.execute().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen && window.innerWidth <= 768) {
      this.closeRequested.emit();
    }
  }
}
