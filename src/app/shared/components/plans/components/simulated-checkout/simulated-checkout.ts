import { I18nModule } from '../../../../../core/i18n/i18n.module';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { SimulatedPaymentModel } from './simulated-payment.model';

@Component({
  selector: 'app-simulated-checkout', standalone: true, imports: [I18nModule, CommonModule, ReactiveFormsModule],
  templateUrl: './simulated-checkout.html', styleUrl: './simulated-checkout.css', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulatedCheckoutComponent {
  @Input({ required: true }) model!: SimulatedPaymentModel;
  @Input() amount: string | null = null;
  @Input() processing = false;
  @Input() disabled = false;
  @Input() actionClass = '';
  @Input() serverError = '';
  @Output() readonly pay = new EventEmitter<void>();
  @Output() readonly cancel = new EventEmitter<void>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  invalid(name: keyof SimulatedPaymentModel['form']['controls']): boolean {
    const control = this.model.form.controls[name]; return control.invalid && (control.touched || control.dirty);
  }
  fill(kind: 'approve' | 'decline'): void { if (!this.processing && !this.disabled) this.model.fill(kind); }
  format(event: Event, field: 'cardNumber' | 'expirationDate' | 'cvv'): void {
    if (this.processing) return;
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, field === 'cardNumber' ? 16 : 4);
    const value = field === 'cardNumber' ? (digits.match(/.{1,4}/g) ?? []).join(' ') : field === 'expirationDate' && digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    this.model.form.controls[field].setValue(value); input.value = value; this.model.error.set('');
  }
  submit(): void {
    if (this.processing || this.disabled || !this.amount) return;
    this.pay.emit();
    const name = Object.entries(this.model.form.controls).find(([, control]) => control.invalid)?.[0];
    if (name) this.element.nativeElement.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)?.focus();
  }
}
