import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { WorkspaceAccessService } from '../../../../services/workspace-access.service';
import { proBenefits } from '../pro-benefits';
import { PRO_ACTIVATION_CONTACT, PRO_MONTHLY_PRICES } from '../pro-offer';

@Component({
  selector: 'app-pro-upgrade-dialog', standalone: true, imports: [CommonModule, MatDialogModule],
  templateUrl: './pro-upgrade-dialog.html', styleUrl: './pro-upgrade-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProUpgradeDialogComponent {
  readonly access = inject(WorkspaceAccessService);
  readonly data = inject<{ spaceId: string }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProUpgradeDialogComponent>);
  readonly benefits = proBenefits;
  readonly prices = inject(PRO_MONTHLY_PRICES);
  readonly contactUrl = inject(PRO_ACTIVATION_CONTACT);
  readonly requestPrepared = signal(false);
  get purposeName(): string { return this.access.purpose() === 'BUSINESS' ? 'Business' : 'Collector'; }
  get monthlyPrice(): string { return this.prices[this.access.purpose() === 'BUSINESS' ? 'BUSINESS' : 'COLLECTOR']; }
  get activationRequest(): string {
    return `Solicito información sobre la activación temprana de VineVault ${this.purposeName} Pro para el espacio «${this.access.space()?.name}» (ID: ${this.data.spaceId}).`;
  }

  constructor() {
    // Never leave an offer attached to another Topbar context or an already changed plan.
    effect(() => {
      if (this.access.space()?.id.value !== this.data.spaceId || this.access.plan() !== 'FREE' || this.access.role() !== 'OWNER') this.dialogRef.close();
    });
  }
}
