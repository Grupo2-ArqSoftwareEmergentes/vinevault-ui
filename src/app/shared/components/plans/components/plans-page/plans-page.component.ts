import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../../header/header';
import { SidebarComponent } from '../../../sidebar/sidebar';
import { WorkspaceAccessService } from '../../../../services/workspace-access.service';
import { ManagementBackLinkComponent } from '../../../management-back-link/management-back-link';

@Component({
  selector: 'app-plans-page', standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, ManagementBackLinkComponent],
  templateUrl: './plans-page.component.html', styleUrl: './plans-page.component.css',
})
export class PlansPageComponent {
  readonly access = inject(WorkspaceAccessService);
  isSidebarOpen = window.innerWidth > 768;
  toggleSidebar(): void { this.isSidebarOpen = !this.isSidebarOpen; }
  closeSidebar(): void { this.isSidebarOpen = false; }
}
