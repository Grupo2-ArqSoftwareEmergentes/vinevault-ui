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
import { WorkspaceContextService } from '../../../services/workspace-context.service';
import { ownerAccess, sampleCatalogResource } from '../../../testing/workspace.fixtures';
import { ProUpgradeDialogComponent } from './pro-upgrade-dialog/pro-upgrade-dialog';
import { CreateSpaceDialogComponent } from '../../create-space-dialog/create-space-dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_CONFIG } from '../../../../api.config';

const base = API_CONFIG.baseUrl;
const card: PaymentDetails = { cardholderName: 'Usuario Demo', cardNumber: '4242 4242 4242 4242', expirationDate: '11/28', cvv: '123' };
const premium: SubscriptionState = { plan: 'PREMIUM', status: 'ACTIVE', usersLimit: 10, ownerUsername: 'usuario_demo', invitedUsers: [], transactionId: 'VV-123456' };

const defaultAccountQuota = {
  extra_spaces_allowance: 0,
  current_spaces: 1,
  max_spaces: 2,
  remaining_spaces: 1,
  can_create_collector: false,
  can_create_business: true,
};

function overviewPayload(overrides: Record<string, unknown> = {}, cellar: Record<string, unknown> | null = null) {
  return {
    billing_mode: 'PREPARATORY',
    account_quota: defaultAccountQuota,
    space: {
      id: 'space-1',
      name: 'Home',
      purpose: 'COLLECTOR',
      subscription_plan: 'FREE',
      subscription_status: 'ACTIVE',
      role: 'OWNER',
      extra_cellars_allowance: 0,
      can_manage_subscription: true,
      can_analyze: true,
      quotas: {
        cellars: { used: 1, limit: 1, remaining: 0 },
        bottles: { used: 35, limit: 50, remaining: 15 },
        skus: { used: 8, limit: null, remaining: null },
      },
      ...overrides,
    },
    cellar,
  };
}

describe('Subscription plans UI', () => {
  let fixture: ComponentFixture<PlansPageComponent>;
  let http: HttpTestingController;

  const flushInitial = (
    spaceOverview: object = overviewPayload(),
    requests: object = { items: [], total: 0, limit: 20, offset: 0 },
    catalog: object = sampleCatalogResource
  ) => {
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush(catalog);
    http.expectOne(`${base}/api/v1/subscriptions/requests?limit=20&offset=0`).flush(requests);
    const overviewReq = http.expectOne((req) => req.url === `${base}/api/v1/subscriptions/overview`);
    overviewReq.flush(spaceOverview);
    return overviewReq;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlansPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(), provideHttpClientTesting(),
        { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [], cellars: [] }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' });
    fixture = TestBed.createComponent(PlansPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    TestBed.inject(MatDialog).closeAll();
    vi.restoreAllMocks();
  });

  it('loads official catalog, space overview and requests dynamically without hardcoded prices or FX conversions', async () => {
    const overviewReq = flushInitial(overviewPayload({}, { id: 'cellar-1', name: 'Cava Principal', space_id: 'space-1', inherits_space_plan: true }));
    expect(overviewReq.request.params.get('space_id')).toBe('space-1');
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Suscripción y Planes');
    expect(element.querySelector('.status-card')?.textContent).toContain('Collector Free (Gratuito)');
    expect(element.querySelector('.status-card')?.textContent).toContain('Cava Principal');
    expect(element.querySelector('.status-card')?.textContent).toContain('Hereda el plan y los cupos de este espacio');
    expect(element.querySelector('.status-card')?.textContent).toContain('1 / 1 cavas');
    expect(element.querySelector('.status-card')?.textContent).toContain('35 / 50 botellas');
    expect(element.querySelector('.pro-offer')?.textContent).toContain('S/ 29.99 PEN');
    expect(element.querySelector('.pro-offer')?.textContent).not.toContain('USD');
    expect(element.querySelector('.pro-benefits')?.textContent).toContain('Hasta 3 cavas base incluidas');
    expect(element.querySelector('.account-addon-card')?.textContent).toContain('$ 5.00 USD');
    expect(element.querySelector('.account-addon-card')?.textContent).toContain('S/ 20.00 PEN');
    expect(element.querySelector('.account-addon-card')?.textContent).toContain('1 Collector · 1 Business');
    expect(element.querySelector('.plans-header app-management-back-link a')?.getAttribute('href')).toBe('/spaces');
  });

  it('queries overview without space_id when no space is selected and still keeps account EXTRA_SPACE available', async () => {
    flushInitial();
    TestBed.inject(WorkspaceScopeService).activate(null);
    fixture.detectChanges();
    const bareOverview = http.expectOne(`${base}/api/v1/subscriptions/overview`);
    expect(bareOverview.request.params.keys()).toEqual([]);
    bareOverview.flush({ billing_mode: 'PREPARATORY', account_quota: defaultAccountQuota, space: null, cellar: null });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeNull();
    expect(fixture.nativeElement.querySelector('.extra-space-cta')).toBeTruthy();
  });

  it('hides space upgrade CTA for non-OWNER roles (can_manage_subscription: false) while keeping account EXTRA_SPACE CTA', async () => {
    flushInitial(overviewPayload({ role: 'WAITER', can_manage_subscription: false, can_analyze: false }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Solo el propietario del espacio puede cambiar el plan');
    expect(fixture.nativeElement.querySelector('.status-card')?.textContent).toContain('No disponible para tu rol o plan actual');
    fixture.componentInstance.showUpgrade();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);

    // WAITER can still open the account-level EXTRA_SPACE modal.
    fixture.nativeElement.querySelector('.extra-space-cta').click();
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs[0].componentInstance).toBeInstanceOf(CreateSpaceDialogComponent);
  });

  it('shows pending upgrade badge and prevents duplicate requests when an UPGRADE_PRO is already PENDING_PAYMENT', async () => {
    flushInitial(overviewPayload(), {
      items: [{
        id: 'intent-1',
        kind: 'UPGRADE_PRO',
        status: 'PENDING_PAYMENT',
        entitlement_scope: 'SPACE',
        entitlements_applied: false,
        space_id: 'space-1',
        cellar_id: null,
        target_plan: 'PRO',
        currency: 'PEN',
        quantity: 1,
        unit_amount: '29.99',
        total_amount: '29.99',
        created_at: '2026-11-19T20:10:00Z',
      }],
      total: 1,
      limit: 20,
      offset: 0,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pending-upgrade-badge')?.textContent).toContain('Upgrade a PRO pendiente de pago');
    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeNull();
    expect(fixture.nativeElement.querySelector('.requests-table')?.textContent).toContain('29.99 PEN/mes');
    expect(fixture.nativeElement.querySelector('.requests-table')?.textContent).toContain('Pendiente de confirmación');
    fixture.componentInstance.showUpgrade();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });

  it('submits a preparatory PRO upgrade with idempotency reuse on retry and never optimistically activates PRO', async () => {
    flushInitial();
    await fixture.whenStable();
    fixture.detectChanges();

    const scope = TestBed.inject(WorkspaceScopeService);
    fixture.nativeElement.querySelector('.upgrade-cta').click();
    await fixture.whenStable();

    const dialogRef = TestBed.inject(MatDialog).openDialogs[0];
    expect(dialogRef.componentInstance).toBeInstanceOf(ProUpgradeDialogComponent);
    const dialogComponent = dialogRef.componentInstance as ProUpgradeDialogComponent;
    const initialKey = dialogComponent.idempotencyKey();

    // First attempt fails with 503 network/server error -> must reuse the EXACT same idempotency_key on retry.
    const submitBtn = document.querySelector<HTMLButtonElement>('app-pro-upgrade-dialog .submit-upgrade')!;
    submitBtn.click();
    await fixture.whenStable();
    expect(submitBtn.disabled).toBe(true);

    const firstReq = http.expectOne(`${base}/api/v1/subscriptions/plan-change-requests`);
    expect(firstReq.request.body).toEqual({
      space_id: 'space-1',
      cellar_id: null,
      target_plan: 'PRO',
      currency: 'PEN',
      idempotency_key: initialKey,
    });
    firstReq.flush({ detail: 'Temporary error' }, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    expect(dialogComponent.idempotencyKey()).toBe(initialKey);

    // Retry reuses the same key and succeeds with 202 Accepted.
    document.querySelector<HTMLButtonElement>('app-pro-upgrade-dialog .submit-upgrade')!.click();
    const retryReq = http.expectOne(`${base}/api/v1/subscriptions/plan-change-requests`);
    expect(retryReq.request.body.idempotency_key).toBe(initialKey);
    retryReq.flush({
      id: 'intent-22',
      kind: 'UPGRADE_PRO',
      status: 'PENDING_PAYMENT',
      entitlement_scope: 'SPACE',
      entitlements_applied: false,
      space_id: 'space-1',
      cellar_id: null,
      target_plan: 'PRO',
      currency: 'PEN',
      quantity: 1,
      unit_amount: '29.99',
      total_amount: '29.99',
      created_at: '2026-11-19T20:15:00Z',
    }, { status: 202, statusText: 'Accepted' });
    http.expectOne(`${base}/api/v1/subscriptions/requests?limit=20&offset=0`).flush({
      items: [{ id: 'intent-22', kind: 'UPGRADE_PRO', status: 'PENDING_PAYMENT', entitlement_scope: 'SPACE', entitlements_applied: false, space_id: 'space-1', currency: 'PEN', quantity: 1, unit_amount: '29.99', total_amount: '29.99', created_at: '2026-11-19T20:15:00Z' }],
      total: 1, limit: 20, offset: 0,
    });
    await fixture.whenStable();

    const overlay = document.querySelector('app-pro-upgrade-dialog')!;
    expect(overlay.textContent).toContain('Solicitud registrada / pendiente de pago');
    expect(overlay.textContent).toContain('29.99 PEN/mes');
    // Local space plan must NOT be optimistically updated to PRO.
    expect(scope.space()?.subscriptionPlan).toBe('FREE');
  });

  it('handles 409 ALREADY_PRO, 409 UPGRADE_PENDING, 409 IDEMPOTENCY_CONFLICT and 422 CURRENCY_UNAVAILABLE cleanly', async () => {
    flushInitial();
    await fixture.whenStable();
    fixture.detectChanges();

    const refreshContext = vi.spyOn(TestBed.inject(WorkspaceContextService), 'refresh').mockImplementation(() => {});
    fixture.componentInstance.showUpgrade();
    await fixture.whenStable();
    const dialogComponent = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ProUpgradeDialogComponent;
    const key1 = dialogComponent.idempotencyKey();

    // 409 IDEMPOTENCY_CONFLICT regenerates idempotency_key.
    dialogComponent.submitUpgrade();
    http.expectOne(`${base}/api/v1/subscriptions/plan-change-requests`).flush(
      { detail: { code: 'IDEMPOTENCY_CONFLICT', message: 'Parámetros distintos para la misma clave.' } },
      { status: 409, statusText: 'Conflict' }
    );
    expect(dialogComponent.idempotencyKey()).not.toBe(key1);

    // 422 CURRENCY_UNAVAILABLE reloads catalog and adjusts selector.
    dialogComponent.submitUpgrade();
    http.expectOne(`${base}/api/v1/subscriptions/plan-change-requests`).flush(
      { detail: { code: 'CURRENCY_UNAVAILABLE', message: 'Moneda no disponible.' } },
      { status: 422, statusText: 'Unprocessable Entity' }
    );
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush(sampleCatalogResource);
    expect(dialogComponent.selectedPrice()?.currency).toBe('PEN');

    // 409 ALREADY_PRO refreshes context and overview.
    dialogComponent.submitUpgrade();
    http.expectOne(`${base}/api/v1/subscriptions/plan-change-requests`).flush(
      { detail: { code: 'ALREADY_PRO', message: 'El espacio ya es PRO.' } },
      { status: 409, statusText: 'Conflict' }
    );
    expect(refreshContext).toHaveBeenCalledOnce();
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1`).flush(overviewPayload({ subscription_plan: 'PRO' }));
    expect(dialogComponent.alreadyPro()).toBe(true);
  });

  it('handles unlimited null quotas accurately and distinguishes them from zero', async () => {
    flushInitial(overviewPayload({
      subscription_plan: 'PRO',
      quotas: {
        cellars: { used: 2, limit: 3, remaining: 1 },
        bottles: { used: 120, limit: null, remaining: null },
        skus: { used: 40, limit: null, remaining: null },
      },
    }));
    await fixture.whenStable();
    fixture.detectChanges();

    const metrics = fixture.nativeElement.querySelector('.metrics').textContent;
    expect(metrics).toContain('2 / 3 cavas');
    expect(metrics).toContain('120 botellas · Ilimitadas');
    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeNull();
  });

  it('closes an open upgrade dialog when switching to another space', async () => {
    flushInitial();
    await fixture.whenStable();
    fixture.componentInstance.showUpgrade();
    await fixture.whenStable();
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    const close = vi.spyOn(ref, 'close');
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-2' }, name: 'Other', spaceType: 'BUSINESS' });
    fixture.detectChanges();
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-2`).flush(overviewPayload({ id: 'space-2', name: 'Other', purpose: 'BUSINESS' }));
    await fixture.whenStable();
    expect(close).toHaveBeenCalled();
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
