import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { PlansPageComponent } from './plans-page/plans-page.component';
import { CheckoutModalComponent } from './checkout-modal/checkout-modal';
import { PaymentFormComponent } from './payment-form/payment-form';
import { MockPaymentService } from '../services/mock-payment.service';
import { PaymentDetails, SubscriptionState } from '../models/payment.model';
import { WorkspaceScopeService } from '../../../services/workspace-scope.service';
import { WorkspaceApiService } from '../../../services/workspace-api.service';
import { ownerAccess } from '../../../testing/workspace.fixtures';

const card: PaymentDetails = { cardholderName: 'Usuario Demo', cardNumber: '4242 4242 4242 4242', expirationDate: '11/28', cvv: '123' };
const premium: SubscriptionState = { plan: 'PREMIUM', status: 'ACTIVE', usersLimit: 10, ownerUsername: 'usuario_demo', invitedUsers: [], transactionId: 'VV-123456' };

describe('Subscription plans UI', () => {
  let fixture: ComponentFixture<PlansPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansPageComponent],
      providers: [
        provideRouter([]),
        { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [], cellars: [] }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlansPageComponent);
    await fixture.whenStable();
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' });
    await fixture.whenStable();
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows the selected space plan and role without user-level simulated billing', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Suscripción y Planes');
    expect(element.querySelector('.status-card')?.textContent).toContain('FREE');
    expect(element.querySelector('.status-card')?.textContent).toContain('OWNER');
    expect(element.querySelector('.status-card')?.textContent).toContain('COLLECTOR');
    expect(element.querySelector('.btn-upgrade-page')).toBeNull();
    expect(element.querySelector('.plans-header app-management-back-link a')?.getAttribute('href')).toBe('/spaces');
  });

  it('does not invent billing or member-management endpoints', () => {
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('endpoints de backend');
    expect(fixture.nativeElement.querySelector('.invite-form')).toBeNull();
  });

  it('reacts to switching to an expired business space', async () => {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-2' }, name: 'Restaurant', subscriptionPlan: 'BUSINESS', subscriptionStatus: 'EXPIRED', spaceType: 'BUSINESS' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('BUSINESS');
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('EXPIRED');
  });

  it('uses the space role rather than subscription ownership from a profile', async () => {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home', role: 'WAITER', subscriptionPlan: 'PRO' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('WAITER');
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('Solo el propietario');
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
