import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-form.html',
  styleUrl: './payment-form.css'
})
export class PaymentFormComponent {
  private readonly fb = inject(FormBuilder);

  @Output() readonly submitPayment = new EventEmitter<{
    cardholderName: string;
    cardNumber: string;
    expirationDate: string;
    cvv: string;
  }>();

  @Output() readonly cancel = new EventEmitter<void>();

  readonly form = this.fb.group({
    cardholderName: ['', [Validators.required, Validators.minLength(3)]],
    cardNumber: ['', [Validators.required, Validators.pattern(/^\d{4} \d{4} \d{4} \d{4}$/)]],
    expirationDate: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
  });

  // Automatically formats card number as "XXXX XXXX XXXX XXXX" while typing
  onCardNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // strip non-digits
    if (value.length > 16) {
      value = value.substring(0, 16);
    }
    
    // Split into 4-digit chunks
    const chunks = value.match(/.{1,4}/g);
    const formatted = chunks ? chunks.join(' ') : '';
    
    this.form.patchValue({ cardNumber: formatted }, { emitEvent: false });
    input.value = formatted;
  }

  // Automatically formats expiration date as "MM/YY" while typing
  onExpirationInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // strip non-digits
    
    if (value.length > 4) {
      value = value.substring(0, 4);
    }

    let formatted = '';
    if (value.length > 2) {
      formatted = `${value.substring(0, 2)}/${value.substring(2)}`;
    } else {
      formatted = value;
    }

    this.form.patchValue({ expirationDate: formatted }, { emitEvent: false });
    input.value = formatted;
  }

  // Restricts CVV input to digits only and max length
  onCvvInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    this.form.patchValue({ cvv: value }, { emitEvent: false });
    input.value = value;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.getRawValue();
    this.submitPayment.emit({
      cardholderName: val.cardholderName ?? '',
      cardNumber: val.cardNumber ?? '',
      expirationDate: val.expirationDate ?? '',
      cvv: val.cvv ?? ''
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  // Form helper methods for validation styling
  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
