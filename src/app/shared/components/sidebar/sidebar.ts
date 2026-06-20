import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { LogoutUseCase } from '../../../iam/domain/use-cases/logout/logout';

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

  readonly navItems: NavItem[] = [
    { label: 'Overview', icon: 'dashboard', route: '/overview', exact: true },
    { label: 'Devices', icon: 'sensors', route: '/devices', exact: true },
    { label: 'Cavas', icon: 'wine_bar', route: '/cavas', exact: true },
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
