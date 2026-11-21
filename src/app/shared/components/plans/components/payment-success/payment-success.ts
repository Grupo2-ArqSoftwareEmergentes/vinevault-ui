import { I18nModule } from '../../../../../core/i18n/i18n.module';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [I18nModule, CommonModule],
  templateUrl: './payment-success.html',
  styleUrl: './payment-success.css'
})
export class PaymentSuccessComponent {
  @Input() transactionId = 'VV-123456';
  @Input() amount = 'S/ 29.99';
  @Input() planName = 'Premium';

  @Output() readonly confirm = new EventEmitter<void>();

  onConfirm(): void {
    this.confirm.emit();
  }
}
