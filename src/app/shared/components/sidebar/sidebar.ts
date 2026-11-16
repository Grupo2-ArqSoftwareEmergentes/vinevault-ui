import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { LogoutUseCase } from '../../../iam/domain/use-cases/logout/logout';
import { WorkspaceAccessService } from '../../services/workspace-access.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class SidebarComponent {
  @Input() isOpen = true;
  @Output() closeRequested = new EventEmitter<void>();
  readonly access = inject(WorkspaceAccessService);
  readonly paidPlan = computed(() => !!this.access.plan() && this.access.plan() !== 'FREE');
  readonly planName = computed(() => !this.access.space() ? 'Select a space' : this.access.plan() ? `${this.access.plan()} plan` : 'Plan unavailable');
  readonly planCaption = computed(() => !this.access.space() ? 'Space subscription' : this.access.status() === 'EXPIRED' ? 'Expired' : this.access.status() !== 'ACTIVE' ? 'Status unavailable' : this.access.plan() === 'FREE' ? 'Explore plans' : this.access.plan() ? `${this.access.plan()} Active` : 'Plan unavailable');

  readonly navItems: NavItem[] = [
    { label: 'Overview', icon: 'dashboard', route: '/overview', exact: true },
    { label: 'Devices', icon: 'sensors', route: '/devices', exact: true },
    { label: 'Alerts', icon: 'notifications_active', route: '/alerts', exact: true },
    { label: 'Inventory', icon: 'inventory', route: '/inventory', exact: true },
  ];

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
