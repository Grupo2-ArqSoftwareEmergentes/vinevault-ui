import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { PaymentFormComponent } from '../payment-form/payment-form';
import { PaymentSuccessComponent } from '../payment-success/payment-success';
import { MockPaymentService } from '../../services/mock-payment.service';

type CheckoutStep = 'FORM' | 'PROCESSING' | 'SUCCESS' | 'REJECTED';

@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatIconModule,
    PaymentFormComponent,
    PaymentSuccessComponent
  ],
  templateUrl: './checkout-modal.html',
  styleUrl: './checkout-modal.css'
})
export class CheckoutModalComponent {
  private readonly dialogRef = inject(MatDialogRef<CheckoutModalComponent>);
  private readonly mockPaymentService = inject(MockPaymentService);

  readonly step = signal<CheckoutStep>('FORM');
  readonly errorMessage = signal<string>('');
  readonly transactionId = signal<string>('');

  onSubmitPayment(cardDetails: {
    cardholderName: string;
    cardNumber: string;
    expirationDate: string;
    cvv: string;
  }): void {
    this.step.set('PROCESSING');
    this.errorMessage.set('');

    this.mockPaymentService.processPayment(cardDetails).subscribe({
      next: (newState) => {
        this.transactionId.set(newState.transactionId ?? 'VV-000000');
        this.step.set('SUCCESS');
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message || 'El pago no pudo procesarse.');
        this.step.set('REJECTED');
      }
    });
  }

  onRetry(): void {
    this.step.set('FORM');
  }

  onClose(): void {
    this.dialogRef.close(this.step() === 'SUCCESS');
  }
}
