import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../../header/header';
import { SidebarComponent } from '../../../sidebar/sidebar';
import { WorkspaceAccessService } from '../../../../services/workspace-access.service';
import { ManagementBackLinkComponent } from '../../../management-back-link/management-back-link';
import { MatDialog } from '@angular/material/dialog';
import { ProUpgradeDialogComponent } from '../pro-upgrade-dialog/pro-upgrade-dialog';
import { proBenefits } from '../pro-benefits';
import { SpaceQuotaSummaryComponent } from '../../../space-quota-summary/space-quota-summary';

@Component({
  selector: 'app-plans-page', standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, ManagementBackLinkComponent, SpaceQuotaSummaryComponent],
  templateUrl: './plans-page.component.html', styleUrl: './plans-page.component.css',
})
export class PlansPageComponent {
  readonly access = inject(WorkspaceAccessService);
  private readonly dialog = inject(MatDialog);
  readonly benefits = proBenefits;
  isSidebarOpen = window.innerWidth > 768;
  toggleSidebar(): void { this.isSidebarOpen = !this.isSidebarOpen; }
  closeSidebar(): void { this.isSidebarOpen = false; }
  showUpgrade(): void {
    const space = this.access.space();
    if (!space || this.access.plan() !== 'FREE' || this.dialog.openDialogs.some(dialog => dialog.componentInstance instanceof ProUpgradeDialogComponent)) return;
    this.dialog.open(ProUpgradeDialogComponent, {
      width: '580px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog',
      ariaLabelledBy: 'pro-upgrade-title', ariaDescribedBy: 'pro-upgrade-description', data: { spaceId: space.id.value },
    });
  }
}
