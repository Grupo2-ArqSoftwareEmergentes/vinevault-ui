import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceSwitcherComponent } from '../workspace-switcher/workspace-switcher';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, WorkspaceSwitcherComponent],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent {
  @Input() isSidebarOpen = true;
  @Input() showWorkspaceSwitcher = false;
  @Output() sidebarToggleRequested = new EventEmitter<void>();

  onToggleSidebar(): void {
    this.sidebarToggleRequested.emit();
  }

}

