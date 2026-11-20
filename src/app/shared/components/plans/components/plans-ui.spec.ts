import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Subject, firstValueFrom, of } from 'rxjs';
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
    billing: { currency: 'PEN', cycle_days: 30, monthly_recurring_total: '0.00', next_cycle_monthly_total: '0.00', active_subscriptions: [] },
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
    expect(element.querySelector('.space-plan-card')?.textContent).toContain('Home');
    expect(element.querySelector('.space-plan-card')?.textContent).toContain('COLLECTOR');
    expect(element.querySelector('.space-plan-card')?.textContent).toContain('FREE');
    expect(element.querySelector('.space-plan-card')?.textContent).toContain('Sin importe activo disponible');
    expect(element.querySelector('.pro-price')?.textContent).toContain('S/ 29.99 / mes');
    expect(element.querySelector('.pro-price')?.textContent).not.toContain('USD');
    expect(element.querySelector('.account-addon-card')?.textContent).toContain('S/ 20.00');
    expect(element.querySelector('.addon-unit-price')?.textContent).toContain('/ cupo al mes');
    expect(element.querySelector('.addon-count')?.textContent).toBe('0');
    expect(element.querySelector('.addon-subtotal')).toBeNull();
    expect(element.textContent).not.toMatch(/USD|\$|\bPEN\b/);
    expect(element.querySelector('.monthly-summary')?.textContent).toContain('Espacios incluidos');
    expect(element.querySelector('.monthly-summary .monthly-total')?.textContent).toContain('S/ 0.00');
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
    expect(fixture.nativeElement.querySelector('.space-plan-card')?.textContent).toContain('COLLECTOR');
    fixture.componentInstance.showUpgrade();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);

    // WAITER can still open the account-level EXTRA_SPACE modal.
    fixture.nativeElement.querySelector('.extra-space-cta').click();
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs[0].componentInstance).toBeInstanceOf(CreateSpaceDialogComponent);
  });

  it('shows pending request history without using it to decide permissions or effective plan', async () => {
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

    expect(fixture.nativeElement.querySelector('.upgrade-cta')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.requests-table')?.textContent).toContain('S/ 29.99 / mes');
    expect(fixture.nativeElement.querySelector('.requests-table')?.textContent).toContain('Pendiente de confirmación');
    fixture.componentInstance.showUpgrade();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
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
    dialogComponent.payment.fill('approve');
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
      confirm_simulated_payment: true,
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
    await fixture.whenStable();

    const overlay = document.querySelector('app-pro-upgrade-dialog')!;
    expect(overlay.textContent).toContain('Solicitud registrada / pendiente de pago');
    expect(overlay.textContent).toContain('S/ 29.99 / mes');
    expect(overlay.textContent).not.toMatch(/USD|\$|\bPEN\b/);
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
    dialogComponent.payment.fill('approve');
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
    expect(refreshContext).not.toHaveBeenCalled();
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1`).flush(overviewPayload({ subscription_plan: 'PRO' }));
    expect(refreshContext).toHaveBeenCalledOnce();
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

    fixture.nativeElement.querySelector('.space-actions .secondary-btn').click();
    await fixture.whenStable();
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

  it('renders every membership but displays server totals even when they differ from catalog arithmetic', async () => {
    const workspace = TestBed.inject(WorkspaceContextService);
    workspace.spaces.set([
      { ...ownerAccess, id: { value: 'space-1' }, name: 'MiColeccion', subscriptionPlan: 'PRO' },
      { ...ownerAccess, id: { value: 'space-2' }, name: 'MiNegocio', spaceType: 'BUSINESS', subscriptionPlan: 'PRO' },
      { ...ownerAccess, id: { value: 'space-3' }, name: 'Otra colección', subscriptionPlan: 'FREE' },
    ]);
    flushInitial({ ...overviewPayload({ subscription_plan: 'PRO' }), account_quota: { ...defaultAccountQuota, current_spaces: 3, max_spaces: 4, extra_spaces_allowance: 2 }, billing: { currency: 'PEN', cycle_days: 30, monthly_recurring_total: '123.45', next_cycle_monthly_total: '29.99', active_subscriptions: [] } });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.space-plan-card')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.monthly-total').textContent).toContain('S/ 123.45');
    expect(fixture.nativeElement.querySelector('.addon-count').textContent).toBe('2');
    expect(fixture.nativeElement.querySelector('.account-addon-card').textContent).not.toContain('S/ 40.00');
    expect(fixture.nativeElement.querySelector('.requests-card').open).toBe(false);
  });

  it('targets an upgrade to a non-selected card and does not apply entitlements or change the account summary locally', async () => {
    flushInitial(); await fixture.whenStable();
    const workspace = TestBed.inject(WorkspaceContextService);
    const other = { ...ownerAccess, id: { value: 'space-2' }, name: 'MiNegocio', spaceType: 'BUSINESS' as const };
    workspace.spaces.set([{ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' }, other]);
    fixture.componentInstance.upgradeSpace(other);
    fixture.detectChanges();
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-2`).flush(overviewPayload({ id: 'space-2', purpose: 'BUSINESS' }));
    await fixture.whenStable();
    const dialog = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ProUpgradeDialogComponent;
    expect(dialog.data.spaceId).toBe('space-2');
    expect(dialog.data.cellarId).toBeNull();
    expect(dialog.purposeName()).toBe('Business');
    expect(workspace.spaces()[1].subscriptionPlan).toBe('FREE');
    expect(fixture.nativeElement.querySelectorAll('.space-plan-card')).toHaveLength(2);
  });

  it('does not advertise zero spend if the account quota or PEN prices are missing', async () => {
    flushInitial({ ...overviewPayload({ subscription_plan: 'PRO' }), account_quota: undefined, billing: null }, undefined, { ...sampleCatalogResource, plans: [] });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.monthly-total').textContent).toContain('no disponible');
  });

  it('does not relabel a historical foreign-currency request as soles or expose its dollar amount', async () => {
    flushInitial(overviewPayload(), { items: [{ id: 'old-usd', kind: 'EXTRA_SPACE', status: 'COMPLETED', currency: 'USD', quantity: 1, unit_amount: '5.00', total_amount: '5.00' }], total: 1, limit: 20, offset: 0 });
    await fixture.whenStable();
    const table = fixture.nativeElement.querySelector('.requests-table');
    expect(table.textContent).toContain('Importe en soles no disponible');
    expect(table.textContent).not.toMatch(/USD|\$|S\/ 5\.00/);
  });

  it('rejects a test card locally and does not unlock PRO or call the API', async () => {
    flushInitial(); await fixture.whenStable();
    fixture.componentInstance.showUpgrade(); await fixture.whenStable();
    const dialog = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ProUpgradeDialogComponent;
    dialog.payment.fill('decline'); dialog.submitUpgrade(); await fixture.whenStable();
    expect(document.querySelector('app-pro-upgrade-dialog .payment-error')?.textContent).toContain('Pago rechazado');
    expect(fixture.componentInstance.currentPlan()).toBe('FREE');
    http.expectNone(req => req.method === 'POST');
    dialog.closeDialog();
    expect(dialog.payment.form.controls.cvv.value).toBe('');
  });

  it('blocks Pro requests without an official soles tariff instead of selecting another currency', async () => {
    flushInitial(overviewPayload(), undefined, { ...sampleCatalogResource, plans: sampleCatalogResource.plans.map(plan => ({ ...plan, prices: [{ currency: 'USD', amount: '5.00' }] })) });
    await fixture.whenStable();
    fixture.componentInstance.showUpgrade(); await fixture.whenStable();
    const dialog = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ProUpgradeDialogComponent;
    expect(dialog.selectedPrice()).toBeNull();
    const overlay = document.querySelector('app-pro-upgrade-dialog')!;
    expect(overlay.textContent).toContain('Tarifa en soles no disponible');
    expect(overlay.textContent).not.toMatch(/USD|\$|\bPEN\b/);
    dialog.submitUpgrade();
    http.expectNone(req => req.method === 'POST');
  });

  it('closes the compact add-on dialog after success and refreshes requests only once without applying allowance', async () => {
    flushInitial(); await fixture.whenStable();
    fixture.componentInstance.openExtraSpaceRequest(); await fixture.whenStable();
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    const completed = firstValueFrom(ref.afterClosed());
    const dialog = ref.componentInstance as CreateSpaceDialogComponent;
    dialog.payment.fill('approve');
    dialog.acquireExtraSpace();
    http.expectOne(`${base}/api/v1/subscriptions/extra-space-requests`).flush({ id: 'extra-one', kind: 'EXTRA_SPACE', status: 'PENDING_PAYMENT', currency: 'PEN', quantity: 1, unit_amount: '20.00', total_amount: '20.00', entitlements_applied: false }, { status: 202, statusText: 'Accepted' });
    await completed;
    http.expectOne(`${base}/api/v1/subscriptions/requests?limit=20&offset=0`).flush({ items: [], total: 0, limit: 20, offset: 0 });
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    expect(fixture.componentInstance.addonFeedback()).toContain('Pendiente de pago');
    expect(fixture.componentInstance.accountQuota()?.extra_spaces_allowance).toBe(0);
  });

  for (const dismissal of ['close', 'escape']) {
    it(`dismisses the add-on dialog with ${dismissal} without submitting`, async () => {
      flushInitial(); await fixture.whenStable();
      fixture.componentInstance.openExtraSpaceRequest(); await fixture.whenStable();
      const ref = TestBed.inject(MatDialog).openDialogs[0];
      const completed = firstValueFrom(ref.afterClosed());
      const button = document.querySelector('app-create-space-dialog .cancel-action') as HTMLButtonElement;
      if (dismissal === 'close') button.click();
      else button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      await completed;
      expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
      http.expectNone(req => req.method === 'POST');
    });
  }

  const activePro = { id: 'active-pro', kind: 'UPGRADE_PRO', status: 'ACTIVE', currency: 'PEN', monthly_amount: '29.99', quantity: 1, space_id: 'space-1', current_period_end: '2026-12-20T00:00:00Z', access_until: '2026-12-20T00:00:00Z', cancel_at_period_end: false, auto_renews: true };
  const activeBilling = { currency: 'PEN', cycle_days: 30, monthly_recurring_total: '149.98', next_cycle_monthly_total: '149.98', active_subscriptions: [activePro] };

  it('cancels only once, retains PRO/current spend and shows the server next-cycle amount and access date', async () => {
    const refresh = vi.spyOn(TestBed.inject(WorkspaceContextService), 'refresh').mockImplementation(() => {});
    flushInitial({ ...overviewPayload({ subscription_plan: 'PRO' }), billing: activeBilling });
    await fixture.whenStable();
    const item = fixture.componentInstance.activeSubscriptions()[0];
    fixture.componentInstance.cancel(item); fixture.componentInstance.cancel(item);
    const post = http.expectOne(`${base}/api/v1/subscriptions/active-pro/cancel`);
    expect(fixture.componentInstance.billing()?.monthly_recurring_total).toBe('149.98');
    const cancelled = { ...activePro, cancel_at_period_end: true, auto_renews: false };
    post.flush(cancelled);
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1`).flush({ ...overviewPayload({ subscription_plan: 'PRO' }), billing: { ...activeBilling, next_cycle_monthly_total: '119.99', active_subscriptions: [cancelled] } });
    await fixture.whenStable();
    expect(refresh).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.currentPlan()).toBe('PRO');
    expect(fixture.componentInstance.billing()?.monthly_recurring_total).toBe('149.98');
    expect(fixture.componentInstance.billing()?.next_cycle_monthly_total).toBe('119.99');
    expect(fixture.nativeElement.querySelector('.active-billing').textContent).toContain('Se cancela al finalizar el ciclo');
    expect(fixture.nativeElement.querySelector('.active-billing button')).toBeNull();
    fixture.componentInstance.cancel(item); http.expectNone(req => req.method === 'POST');
  });

  it('denies PRO cancellation without overview OWNER permission but keeps purchased account add-ons independent', async () => {
    const extra = { ...activePro, id: 'own-extra', kind: 'EXTRA_SPACE', space_id: null };
    flushInitial({ ...overviewPayload({ subscription_plan: 'PRO', can_manage_subscription: false, role: 'WAITER' }), billing: { ...activeBilling, active_subscriptions: [activePro, extra] } });
    await fixture.whenStable();
    const [pro, addon] = fixture.componentInstance.activeSubscriptions();
    expect(fixture.componentInstance.canCancel(pro)).toBe(false);
    expect(fixture.componentInstance.canCancel(addon)).toBe(true);
    fixture.componentInstance.cancel(pro); http.expectNone(req => req.method === 'POST');
  });

  it('activates Pro only after server confirmation, then refreshes overview before context and uses real unlimited quotas', async () => {
    const refresh = vi.spyOn(TestBed.inject(WorkspaceContextService), 'refresh').mockImplementation(() => {});
    flushInitial(); await fixture.whenStable();
    fixture.componentInstance.showUpgrade(); await fixture.whenStable();
    const dialog = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ProUpgradeDialogComponent;
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    dialog.payment.fill('approve');
    expect(document.querySelector('app-pro-upgrade-dialog')?.textContent).toContain('Pago simulado');
    expect(document.querySelector('app-pro-upgrade-dialog input[type="checkbox"]')).toBeNull();
    dialog.submitUpgrade();
    const post = http.expectOne(`${base}/api/v1/subscriptions/plan-change-requests`);
    expect(post.request.body.confirm_simulated_payment).toBe(true);
    expect(fixture.componentInstance.currentPlan()).toBe('FREE');
    post.flush({ status: 'FULFILLED', entitlements_applied: true, payment_mode: 'SIMULATED', currency: 'PEN', subscription: activePro }, { status: 201, statusText: 'Created' });
    expect(refresh).not.toHaveBeenCalled(); expect(fixture.componentInstance.currentPlan()).toBe('FREE');
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1`).flush({ ...overviewPayload({ subscription_plan: 'PRO', quotas: { cellars: { used: 1, limit: 3, remaining: 2 }, bottles: { used: 100, limit: null, remaining: null }, skus: { used: 30, limit: null, remaining: null } } }), billing: activeBilling });
    await fixture.whenStable();
    await closed;
    http.expectOne(`${base}/api/v1/subscriptions/requests?limit=20&offset=0`).flush({ items: [], total: 0, limit: 20, offset: 0 });
    expect(refresh).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.currentPlan()).toBe('PRO');
    expect(fixture.componentInstance.overviewSpace()?.quotas.bottles.limit).toBeNull();
    expect(dialog.fulfilled()).toBe(true);
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
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
