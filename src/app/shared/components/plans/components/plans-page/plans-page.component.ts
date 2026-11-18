import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../../header/header';
import { SidebarComponent } from '../../../sidebar/sidebar';
import { WorkspaceAccessService } from '../../../../services/workspace-access.service';
import { ManagementBackLinkComponent } from '../../../management-back-link/management-back-link';
import { MatDialog } from '@angular/material/dialog';
import { ProUpgradeDialogComponent } from '../pro-upgrade-dialog/pro-upgrade-dialog';
import { proBenefits } from '../pro-benefits';
import { PRO_MONTHLY_PRICES } from '../pro-offer';
import { ResourceQuota } from '../../../../models/workspace-context';

@Component({
  selector: 'app-plans-page', standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, ManagementBackLinkComponent],
  templateUrl: './plans-page.component.html', styleUrl: './plans-page.component.css',
})
export class PlansPageComponent {
  readonly access = inject(WorkspaceAccessService);
  private readonly dialog = inject(MatDialog);
  readonly benefits = proBenefits;
  readonly prices = inject(PRO_MONTHLY_PRICES);
  get purposeName(): string { return this.access.purpose() === 'BUSINESS' ? 'Business' : this.access.purpose() === 'COLLECTOR' ? 'Collector' : 'Espacio'; }
  get monthlyPrice(): string | null { const purpose = this.access.purpose(); return purpose ? this.prices[purpose] : null; }
  quotaLabel(quota: ResourceQuota | undefined, unit: string, unlimited: string): string {
    if (!quota) return 'No disponible';
    return quota.limit === null ? `${quota.used} ${unit} · ${unlimited}` : `${quota.used} / ${quota.limit} ${unit}`;
  }
  isSidebarOpen = window.innerWidth > 768;
  toggleSidebar(): void { this.isSidebarOpen = !this.isSidebarOpen; }
  closeSidebar(): void { this.isSidebarOpen = false; }
  showUpgrade(): void {
    const space = this.access.space();
    if (!space || this.access.role() !== 'OWNER' || !this.access.purpose() || this.access.plan() !== 'FREE' || this.dialog.openDialogs.some(dialog => dialog.componentInstance instanceof ProUpgradeDialogComponent)) return;
    this.dialog.open(ProUpgradeDialogComponent, {
      width: '768px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog',
      ariaLabelledBy: 'pro-upgrade-title', ariaDescribedBy: 'pro-upgrade-description', data: { spaceId: space.id.value },
    });
  }
}
