import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SimulatedCheckoutComponent } from './simulated-checkout';
import { checkoutAmount, SimulatedPaymentModel } from './simulated-payment.model';

describe('Simulated subscription checkout', () => {
  let fixture: ComponentFixture<SimulatedCheckoutComponent>;
  let model: SimulatedPaymentModel;
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SimulatedCheckoutComponent] });
    model = new SimulatedPaymentModel();
    fixture = TestBed.createComponent(SimulatedCheckoutComponent);
    fixture.componentRef.setInput('model', model); fixture.componentRef.setInput('amount', 'S/ 20.00');
    fixture.componentInstance.pay.subscribe(() => model.authorize());
    await fixture.whenStable();
  });

  it('requires the four card fields and focuses the first invalid field', async () => {
    fixture.nativeElement.querySelector('.pay-button').click(); await fixture.whenStable();
    expect(model.form.invalid).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.field-error')).toHaveLength(4);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#checkout-holder'));
    expect(model.error()).toContain('Revisa los datos');
  });

  it('formats digits in groups of four, MM/YY and a numeric CVV', async () => {
    for (const [selector, value] of [['#checkout-number', '4242424242424242'], ['#checkout-expiration', '1235'], ['#checkout-cvv', '12x34']]) {
      const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    expect(model.form.controls.cardNumber.value).toBe('4242 4242 4242 4242');
    expect(model.form.controls.expirationDate.value).toBe('12/35');
    expect(model.form.controls.cvv.value).toBe('1234');
  });

  it('fills valid synthetic values with both chips and rejects the decline card locally', async () => {
    fixture.nativeElement.querySelector('.test-decline').click(); await fixture.whenStable();
    expect(model.form.valid).toBe(true); expect(model.authorize()).toBe(false);
    expect(model.error()).toContain('Pago rechazado');
    fixture.nativeElement.querySelector('.test-approve').click(); await fixture.whenStable();
    expect(model.authorize()).toBe(true); expect(model.error()).toBe('');
  });

  it('validates whitespace, 16 digits, valid expiration and a 3/4-digit CVV', () => {
    model.fill('approve'); model.form.controls.cardholderName.setValue('  '); expect(model.authorize()).toBe(false);
    model.fill('approve'); model.form.controls.cardNumber.setValue('4242 4242 4242'); expect(model.authorize()).toBe(false);
    model.fill('approve'); model.form.controls.expirationDate.setValue('01/20'); expect(model.authorize()).toBe(false);
    model.fill('approve'); model.form.controls.expirationDate.setValue('13/99'); expect(model.authorize()).toBe(false);
    model.fill('approve'); model.form.controls.cvv.setValue('12'); expect(model.authorize()).toBe(false);
    model.fill('approve'); model.form.controls.cvv.setValue('1234'); expect(model.authorize()).toBe(true);
  });

  it('blocks payment, chips and cancellation while processing and exposes progress', async () => {
    const pay = vi.spyOn(fixture.componentInstance.pay, 'emit');
    const cancel = vi.spyOn(fixture.componentInstance.cancel, 'emit');
    fixture.componentRef.setInput('processing', true); await fixture.whenStable();
    fixture.nativeElement.querySelector('.pay-button').click(); fixture.nativeElement.querySelector('.cancel-action').click();
    fixture.componentInstance.fill('approve');
    expect(model.form.controls.cardNumber.value).toBe('');
    expect(pay).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Procesando');
  });

  it('does not turn Cancelar into a payment submission', () => {
    const pay = vi.spyOn(fixture.componentInstance.pay, 'emit'); const cancel = vi.spyOn(fixture.componentInstance.cancel, 'emit');
    fixture.nativeElement.querySelector('.cancel-action').click();
    expect(cancel).toHaveBeenCalledOnce(); expect(pay).not.toHaveBeenCalled();
  });

  it('computes only a checkout preview with exact cents, never a billing aggregate', () => {
    expect(checkoutAmount('20.00', 2)).toBe('S/ 40.00'); expect(checkoutAmount('20.00', 100)).toBe('S/ 2000.00');
    expect(checkoutAmount('29.99', 3)).toBe('S/ 89.97'); expect(checkoutAmount('79.99')).toBe('S/ 79.99');
    expect(checkoutAmount('20.00', 0)).toBeNull(); expect(checkoutAmount('20.00', 101)).toBeNull();
    expect(checkoutAmount('20.00', 1.5)).toBeNull(); expect(checkoutAmount(undefined)).toBeNull();
  });
});
