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
import { ProUpgradeDialogComponent } from './pro-upgrade-dialog/pro-upgrade-dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

const card: PaymentDetails = { cardholderName: 'Usuario Demo', cardNumber: '4242 4242 4242 4242', expirationDate: '11/28', cvv: '123' };
const premium: SubscriptionState = { plan: 'PREMIUM', status: 'ACTIVE', usersLimit: 10, ownerUsername: 'usuario_demo', invitedUsers: [], transactionId: 'VV-123456' };

describe('Subscription plans UI', () => {
  let fixture: ComponentFixture<PlansPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(), provideHttpClientTesting(),
        { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [], cellars: [] }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlansPageComponent);
    await fixture.whenStable();
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' });
    await fixture.whenStable();
  });

  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.inject(MatDialog).closeAll(); vi.restoreAllMocks(); });

  it('shows the selected space plan and role without user-level simulated billing', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Suscripción y Planes');
    expect(element.querySelector('.status-card')?.textContent).toContain('Collector Free (Gratuito)');
    expect(element.querySelector('.status-card')?.textContent).toContain('OWNER');
    expect(element.querySelector('.pro-offer')?.textContent).toContain('VineVault Collector Pro');
    expect(element.querySelector('.upgrade-cta')?.textContent).toContain('Actualizar a Pro');
    expect(element.querySelector('.plans-header app-management-back-link a')?.getAttribute('href')).toBe('/spaces');
  });

  it('does not invent billing or member-management endpoints', () => {
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('Los cambios de plan y los cupos se gestionan desde el servidor');
    expect(fixture.nativeElement.querySelector('.invite-form')).toBeNull();
  });

  it('reacts to switching to an expired business space', async () => {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-2' }, name: 'Restaurant', subscriptionPlan: 'PRO', subscriptionStatus: 'EXPIRED', spaceType: 'BUSINESS' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('Business Pro');
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('EXPIRED');
    expect(fixture.nativeElement.querySelector('.pro-badge').textContent).toContain('Expirado');
    expect(fixture.nativeElement.querySelector('.pro-badge').textContent).not.toContain('Activo');
    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeNull();
  });

  it('uses the space role rather than subscription ownership from a profile', async () => {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home', role: 'WAITER', subscriptionPlan: 'PRO' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('WAITER');
    expect(fixture.nativeElement.querySelector('.status-card').textContent).toContain('Solo el propietario');
    expect(fixture.nativeElement.querySelector('.invite-form')).toBeNull();
  });

  for (const purpose of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`opens an informational ${purpose} offer without billing requests or local quota changes`, async () => {
      const quotas = { cellars: { used: 1, limit: 1, remaining: 0 }, bottles: { used: 50, limit: 50, remaining: 0 }, skus: { used: 25, limit: 25, remaining: 0 } };
      const scope = TestBed.inject(WorkspaceScopeService);
      scope.activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home', spaceType: purpose, quotas, extra_cellars_allowance: 0 });
      await fixture.whenStable();
      const original = scope.space();
      fixture.nativeElement.querySelector('.upgrade-cta').click();
      fixture.componentInstance.showUpgrade();
      await fixture.whenStable();
      const dialogs = TestBed.inject(MatDialog).openDialogs;
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0].componentInstance).toBeInstanceOf(ProUpgradeDialogComponent);
      const overlay = document.querySelector('app-pro-upgrade-dialog')!;
      expect(overlay.textContent).toContain(purpose === 'BUSINESS' ? 'Haz crecer tu negocio' : 'Dale más espacio a tu colección');
      expect(overlay.textContent).toContain('Pagos disponibles pronto');
      expect(overlay.textContent).toContain('no se realizará ningún cobro ni se activará Pro');
      expect(overlay.textContent).toContain(purpose === 'BUSINESS' ? 'SKUs sin límite: amplía las referencias de tu negocio' : 'Botellas sin límite para hacer crecer tu colección');
      (overlay.querySelector('.acknowledge') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(scope.space()).toBe(original);
      expect(scope.space()?.quotas).toEqual(quotas);
      expect(scope.space()?.subscriptionPlan).toBe('FREE');
      expect(scope.space()?.extra_cellars_allowance).toBe(0);
      TestBed.inject(HttpTestingController).expectNone(() => true);
    });
  }

  it('shows active PRO benefits rather than an upgrade CTA', async () => {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home', subscriptionPlan: 'PRO' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.pro-badge').textContent).toBe('Plan Pro Activo');
    expect(fixture.nativeElement.querySelector('.pro-benefits').textContent).toContain('Hasta 3 cavas incluidas');
    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeNull();
    fixture.componentInstance.showUpgrade();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });

  it('closes an open offer when switching spaces and does not open one without selection', async () => {
    fixture.componentInstance.showUpgrade();
    await fixture.whenStable();
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    const close = vi.spyOn(ref, 'close');
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-2' }, name: 'Other', spaceType: 'BUSINESS' });
    await fixture.whenStable();
    expect(close).toHaveBeenCalled();
    TestBed.inject(WorkspaceScopeService).activate(null);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeNull();
    fixture.componentInstance.showUpgrade();
    expect(fixture.nativeElement.querySelector('.pro-badge')).toBeNull();
  });

  for (const purpose of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`renders real ${purpose} consumption independently of advertised Pro capacity`, async () => {
      const quotas = { cellars: { used: 4, limit: 6, remaining: 2 }, bottles: { used: 35, limit: 50, remaining: 15 }, skus: { used: 7, limit: 25, remaining: 18 } };
      TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'My space', spaceType: purpose, quotas });
      await fixture.whenStable();
      const metrics = fixture.nativeElement.querySelector('.metrics').textContent;
      expect(metrics).toContain('4 / 6 cavas');
      expect(metrics).toContain(purpose === 'COLLECTOR' ? '35 / 50 botellas' : '7 / 25 SKUs');
      expect(fixture.nativeElement.querySelector('.offer-price').textContent).toContain(purpose === 'COLLECTOR' ? 'S/ 29.99' : 'S/ 79.99');
      expect(fixture.nativeElement.querySelector('.subscription-status').classList.contains('active')).toBe(true);
    });
  }

  it('distinguishes unlimited server quotas from missing metadata', async () => {
    expect(fixture.nativeElement.querySelector('.metrics').textContent).toContain('No disponible');
    const unlimited = { used: 8, limit: null, remaining: null };
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home', subscriptionPlan: 'PRO', quotas: { cellars: unlimited, bottles: unlimited, skus: unlimited } });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.metrics').textContent).toContain('8 cavas · Ilimitadas');
    expect(fixture.nativeElement.querySelector('.metrics').textContent).toContain('8 botellas · Ilimitadas');
  });

  it('hides and guards upgrade for a non-owner even on Free', async () => {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home', role: 'SOMMELIER' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeNull();
    fixture.componentInstance.showUpgrade();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });

  it('prepares an explicitly unsent request for the exact space without payment fields or HTTP', async () => {
    fixture.componentInstance.showUpgrade();
    await fixture.whenStable();
    const overlay = document.querySelector('app-pro-upgrade-dialog')!;
    expect(overlay.querySelector('.plan-summary')?.textContent).toContain('Collector Pro');
    expect(overlay.querySelector('.activation-panel h2')?.textContent).toContain('Activar Plan Pro');
    expect(overlay.querySelector('input, app-payment-form')).toBeNull();
    (overlay.querySelector('button.contact-link') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect((overlay.querySelector('textarea') as HTMLTextAreaElement).value).toContain('«Home» (ID: space-1)');
    expect(overlay.textContent).toContain('Solicitud preparada, no enviada');
    TestBed.inject(HttpTestingController).expectNone(() => true);
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
