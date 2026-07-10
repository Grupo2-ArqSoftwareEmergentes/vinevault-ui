import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MockPaymentService } from '../plans/services/mock-payment.service';
import { CheckoutModalComponent } from '../plans/components/checkout-modal/checkout-modal';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent {
  @Input() isSidebarOpen = true;
  @Output() sidebarToggleRequested = new EventEmitter<void>();

  private readonly dialog = inject(MatDialog);
  private readonly paymentService = inject(MockPaymentService);

  readonly subscription = this.paymentService.subscription;
  readonly effectivePlan = this.paymentService.effectivePlan;

  onToggleSidebar(): void {
    this.sidebarToggleRequested.emit();
  }

  openCheckout(): void {
    this.dialog.open(CheckoutModalComponent, {
      width: '860px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      disableClose: true,
      autoFocus: false
    });
  }

  resetSubscription(): void {
    this.paymentService.resetToFree();
  }
}

