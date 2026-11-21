import { signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';

function expiration(control: AbstractControl): ValidationErrors | null {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(control.value ?? '');
  if (!match) return { expiration: true };
  const now = new Date();
  return 2000 + Number(match[2]) < now.getFullYear() ||
    (2000 + Number(match[2]) === now.getFullYear() && Number(match[1]) < now.getMonth() + 1) ? { expiration: true } : null;
}

/** Test-card data exists only in this form; it is never part of an API payload. */
export class SimulatedPaymentModel {
  readonly error = signal('');
  readonly form = new FormGroup({
    cardholderName: new FormControl('', { nonNullable: true, validators: [control => control.value?.trim() ? null : { required: true }] }),
    cardNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{4} \d{4} \d{4} \d{4}$/)] }),
    expirationDate: new FormControl('', { nonNullable: true, validators: [Validators.required, expiration] }),
    cvv: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{3,4}$/)] }),
  });

  fill(kind: 'approve' | 'decline'): void {
    this.error.set('');
    this.form.reset({ cardholderName: 'Usuario de prueba', cardNumber: kind === 'approve' ? '4242 4242 4242 4242' : '4000 0000 0000 0002', expirationDate: `12/${String(new Date().getFullYear() + 2).slice(-2)}`, cvv: '123' });
  }

  authorize(): boolean {
    this.error.set('');
    this.form.updateValueAndValidity();
    this.form.controls.expirationDate.updateValueAndValidity();
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Revisa los datos de la tarjeta. Usa únicamente datos de prueba.'); return false; }
    if (this.form.controls.cardNumber.value.replace(/\s/g, '') === '4000000000000002') {
      this.error.set('Pago rechazado. La tarjeta de prueba fue rechazada. Puedes probar con la tarjeta Aprobar.'); return false;
    }
    return true;
  }

  clear(): void { this.form.reset(); this.error.set(''); }
}

/** Checkout preview only: exact catalog decimal × quantity. Billing totals remain server-owned. */
export function checkoutAmount(amount: string | undefined, quantity = 1): string | null {
  if (!amount || !/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return null;
  const [whole, fraction = ''] = amount.split('.');
  const cents = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * BigInt(quantity);
  return `S/ ${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
