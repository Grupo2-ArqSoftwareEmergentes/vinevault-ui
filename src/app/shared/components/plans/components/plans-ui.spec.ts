import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { PlansPageComponent } from './plans-page/plans-page.component';
import { CheckoutModalComponent } from './checkout-modal/checkout-modal';
import { PaymentFormComponent } from './payment-form/payment-form';
import { MockPaymentService } from '../services/mock-payment.service';
import { PaymentDetails, SubscriptionState } from '../models/payment.model';

const card: PaymentDetails = { cardholderName: 'Usuario Demo', cardNumber: '4242 4242 4242 4242', expirationDate: '11/28', cvv: '123' };
const premium: SubscriptionState = { plan: 'PREMIUM', status: 'ACTIVE', usersLimit: 10, ownerUsername: 'usuario_demo', invitedUsers: [], transactionId: 'VV-123456' };

describe('Subscription plans UI', () => {
  let fixture: ComponentFixture<PlansPageComponent>;
  const subscription = signal<SubscriptionState>({ plan: 'FREE', status: 'INACTIVE', usersLimit: 1, invitedUsers: [] });
  const plan = signal<'FREE' | 'PREMIUM'>('FREE');
  const inviteUser = vi.fn();
  const removeUser = vi.fn();

  beforeEach(async () => {
    subscription.set({ plan: 'FREE', status: 'INACTIVE', usersLimit: 1, invitedUsers: [] });
    plan.set('FREE');
    inviteUser.mockReset();
    removeUser.mockReset();
    await TestBed.configureTestingModule({
      imports: [PlansPageComponent],
      providers: [
        provideRouter([]),
        { provide: MockPaymentService, useValue: { subscription, effectivePlan: plan, inviteUser, removeInvitedUser: removeUser, resetToFree: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlansPageComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows current-plan limits, the VIP offer, and the unchanged price', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Suscripción y Planes');
    expect(element.querySelector('.free-status-card')).toBeTruthy();
    expect(element.querySelectorAll('.limit-row').length).toBe(4);
    expect(element.querySelector('.vip-badge')?.textContent).toBe('VIP / RECOMENDADO');
    expect(element.querySelector('.offer-price')?.textContent).toContain('S/ 29.99');
  });

  it('opens the checkout from the upgrade action with its existing modal safeguards', () => {
    const dialog = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockImplementation(() => undefined as never);
    fixture.nativeElement.querySelector('.btn-upgrade-page').click();
    expect(dialog).toHaveBeenCalledWith(CheckoutModalComponent, expect.objectContaining({
      disableClose: true, maxWidth: '95vw', maxHeight: '95vh', panelClass: 'subscription-checkout-dialog',
    }));
  });

  it('keeps owner delegation and revocation available after Premium activation', async () => {
    subscription.set({ ...premium, invitedUsers: ['guest@example.com'] });
    plan.set('PREMIUM');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.upgrade-offer-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.delegation-card')).toBeTruthy();
    const input = fixture.nativeElement.querySelector('.invite-input') as HTMLInputElement;
    input.value = 'new@example.com';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('.invite-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(inviteUser).toHaveBeenCalledWith('new@example.com');
    fixture.nativeElement.querySelector('.btn-remove-invite').click();
    expect(removeUser).toHaveBeenCalledWith('guest@example.com');
  });

  it('retains the guest-only Premium notice without owner controls', async () => {
    subscription.set({ ...premium, ownerUsername: 'another-owner', invitedUsers: ['usuario_demo'] });
    plan.set('PREMIUM');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.guest-notice-card')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.invite-form')).toBeNull();
  });
});

describe('Payment form', () => {
  let fixture: ComponentFixture<PaymentFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PaymentFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(PaymentFormComponent);
    await fixture.whenStable();
  });

  it('retains validation and exposes field errors accessibly', async () => {
    const emit = vi.spyOn(fixture.componentInstance.submitPayment, 'emit');
    fixture.nativeElement.querySelector('.btn-primary').click();
    await fixture.whenStable();
    expect(emit).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.error-msg').length).toBe(4);
    expect(fixture.nativeElement.querySelector('#cardNumber').getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('#cardNumber').getAttribute('aria-describedby')).toBe('card-number-error');
  });

  it('formats card, expiration, and CVV without changing the emitted payload', async () => {
    const emit = vi.spyOn(fixture.componentInstance.submitPayment, 'emit');
    fixture.componentInstance.form.controls.cardholderName.setValue(card.cardholderName);
    for (const [id, value] of [['cardNumber', '4242424242424242'], ['expirationDate', '1128'], ['cvv', '123x']]) {
      const input = fixture.nativeElement.querySelector('#' + id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    expect(fixture.componentInstance.form.getRawValue()).toEqual(card);
    fixture.nativeElement.querySelector('.btn-primary').click();
    expect(emit).toHaveBeenCalledWith(card);
  });

  it('keeps cancellation independent of payment submission', () => {
    const cancel = vi.spyOn(fixture.componentInstance.cancel, 'emit');
    fixture.nativeElement.querySelector('.btn-secondary').click();
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe('Checkout states', () => {
  let fixture: ComponentFixture<CheckoutModalComponent>;
  let pending: Subject<SubscriptionState>;
  const close = vi.fn();
  const processPayment = vi.fn();

  beforeEach(async () => {
    close.mockReset();
    pending = new Subject<SubscriptionState>();
    processPayment.mockReset().mockReturnValue(pending);
    await TestBed.configureTestingModule({
      imports: [CheckoutModalComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MockPaymentService, useValue: { processPayment } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CheckoutModalComponent);
    await fixture.whenStable();
  });

  it('identifies the sandbox and closes an unpaid checkout with false', () => {
    expect(fixture.nativeElement.querySelector('.secure-checkout-tag').textContent).toContain('Sin cobros reales');
    fixture.nativeElement.querySelector('.close-btn').click();
    expect(close).toHaveBeenCalledWith(false);
  });

  it('preserves processing, transaction confirmation, and successful close', async () => {
    fixture.componentInstance.onSubmitPayment(card);
    await fixture.whenStable();
    expect(processPayment).toHaveBeenCalledWith(card);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.close-btn')).toBeNull();
    pending.next(premium);
    pending.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.transaction-id').textContent).toBe('VV-123456');
    fixture.nativeElement.querySelector('.btn-continue').click();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('shows rejection details and returns to the form for retry', async () => {
    fixture.componentInstance.onSubmitPayment(card);
    pending.error(new Error('Tarjeta rechazada'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Tarjeta rechazada');
    fixture.nativeElement.querySelector('.btn-retry').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-payment-form')).toBeTruthy();
  });
});
