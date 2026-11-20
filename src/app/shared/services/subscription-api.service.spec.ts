import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../../api.config';
import { SubscriptionApiService } from './subscription-api.service';
import { WorkspaceScopeService } from './workspace-scope.service';
import { formatQuotedMonthly, formatSubscriptionMoney, generateIdempotencyKey } from '../models/subscription';
import { sampleCatalogResource } from '../testing/workspace.fixtures';
import { WorkspaceContextService } from './workspace-context.service';
import { vi } from 'vitest';

const base = API_CONFIG.baseUrl;

describe('SubscriptionApiService', () => {
  let service: SubscriptionApiService;
  let http: HttpTestingController;
  const refreshContext = vi.fn();

  beforeEach(() => {
    refreshContext.mockReset();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: WorkspaceContextService, useValue: { refresh: refreshContext } }],
    });
    service = TestBed.inject(SubscriptionApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches and caches the official catalog, preserving decimal strings and null unlimited limits', async () => {
    const promise = firstValueFrom(service.getCatalog());
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush(sampleCatalogResource);
    const catalog = await promise;
    expect(catalog.billing_mode).toBe('PREPARATORY');
    expect(catalog.courtesy_spaces).toEqual({ COLLECTOR: 1, BUSINESS: 1 });
    expect(catalog.plans.find((p) => p.purpose === 'COLLECTOR' && p.tier === 'PRO')?.prices).toEqual([{ currency: 'PEN', amount: '29.99' }]);
    expect(catalog.plans.find((p) => p.purpose === 'COLLECTOR' && p.tier === 'PRO')?.limits).toEqual({ cellars: 3, bottles: null, skus: null });
    expect(catalog.addons[0].prices).toEqual([{ currency: 'USD', amount: '5.00' }, { currency: 'PEN', amount: '20.00' }]);

    // Cached second call does not trigger HTTP unless forced.
    const cached = await firstValueFrom(service.getCatalog());
    expect(cached).toBe(catalog);
    http.expectNone(`${base}/api/v1/subscriptions/catalog`);

    // Session invalidation clears cached state.
    TestBed.inject(WorkspaceScopeService).invalidateSession();
    expect(service.catalog()).toBeNull();
  });

  it('never sends cellar_id without space_id on overview queries', () => {
    service.getOverview(null, 'cellar-orphan').subscribe();
    const bare = http.expectOne((req) => req.url === `${base}/api/v1/subscriptions/overview`);
    expect(bare.request.params.has('space_id')).toBe(false);
    expect(bare.request.params.has('cellar_id')).toBe(false);
    bare.flush({ billing_mode: 'PREPARATORY', account_quota: { extra_spaces_allowance: 0, current_spaces: 1, max_spaces: 2, remaining_spaces: 1, can_create_collector: false, can_create_business: true }, space: null });

    service.getOverview('space-1', 'cellar-1').subscribe();
    const scoped = http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1&cellar_id=cellar-1`);
    scoped.flush({
      billing_mode: 'PREPARATORY',
      account_quota: { extra_spaces_allowance: 0, current_spaces: 1, max_spaces: 2, remaining_spaces: 1, can_create_collector: false, can_create_business: true },
      space: {
        id: 'space-1', name: 'Mi Cava', purpose: 'COLLECTOR', subscription_plan: 'FREE', subscription_status: 'ACTIVE',
        role: 'OWNER', extra_cellars_allowance: 0, can_manage_subscription: true, can_analyze: true,
        quotas: { cellars: { used: 1, limit: 1, remaining: 0 }, bottles: { used: 10, limit: 50, remaining: 40 }, skus: { used: 3, limit: null, remaining: null } },
      },
      cellar: { id: 'cellar-1', name: 'Cava Principal', space_id: 'space-1', inherits_space_plan: true },
    });
    expect(service.overview()?.cellar?.inherits_space_plan).toBe(true);
    expect(service.overview()?.space?.can_manage_subscription).toBe(true);
  });

  it('sends strictly documented fields for plan-change and extra-space requests and validates integer quantity', () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    service.createPlanChangeRequest({ space_id: 'space-1', cellar_id: null, target_plan: 'PRO', currency: 'pen', idempotency_key: key }).subscribe();
    const planReq = http.expectOne(`${base}/api/v1/subscriptions/plan-change-requests`);
    expect(planReq.request.method).toBe('POST');
    expect(planReq.request.body).toEqual({
      space_id: 'space-1',
      cellar_id: null,
      target_plan: 'PRO',
      currency: 'PEN',
      idempotency_key: key,
    });
    planReq.flush({ id: 'req-1', kind: 'UPGRADE_PRO', status: 'PENDING_PAYMENT', entitlement_scope: 'SPACE', entitlements_applied: false, space_id: 'space-1', currency: 'PEN', quantity: 1, unit_amount: '29.99', total_amount: '29.99', created_at: '2026-11-19T20:00:00Z' }, { status: 202, statusText: 'Accepted' });

    expect(() => service.createExtraSpaceRequest({ currency: 'USD', quantity: 0, idempotency_key: key })).toThrow();
    expect(() => service.createExtraSpaceRequest({ currency: 'USD', quantity: 1.5, idempotency_key: key })).toThrow();
    expect(() => service.createExtraSpaceRequest({ currency: 'USD', quantity: 101, idempotency_key: key })).toThrow();

    service.createExtraSpaceRequest({ currency: 'usd', quantity: 2, idempotency_key: key }).subscribe();
    const extraReq = http.expectOne(`${base}/api/v1/subscriptions/extra-space-requests`);
    expect(extraReq.request.body).toEqual({ currency: 'USD', quantity: 2, idempotency_key: key });
    expect(typeof extraReq.request.body.quantity).toBe('number');
    extraReq.flush({ id: 'req-2', kind: 'EXTRA_SPACE', status: 'PENDING_PAYMENT', entitlement_scope: 'ACCOUNT', entitlements_applied: false, space_id: null, currency: 'USD', quantity: 2, unit_amount: '5.00', total_amount: '10.00', created_at: '2026-11-19T20:05:00Z' }, { status: 202, statusText: 'Accepted' });
  });

  it('formats server decimal amounts without client-side currency conversions', () => {
    expect(formatSubscriptionMoney('29.99', 'PEN')).toBe('S/ 29.99 PEN');
    expect(formatSubscriptionMoney('5.00', 'USD')).toBe('$ 5.00 USD');
    expect(formatQuotedMonthly('20.00', 'PEN')).toBe('20.00 PEN/mes');
  });

  const subscription = { id: 'sub-1', kind: 'UPGRADE_PRO', status: 'ACTIVE', currency: 'PEN', monthly_amount: '29.99', quantity: 1, space_id: 'space-1', current_period_end: '2026-12-20T00:00:00Z', access_until: '2026-12-20T00:00:00Z', cancel_at_period_end: false, auto_renews: true };
  const billing = { currency: 'PEN', cycle_days: 30, monthly_recurring_total: '149.98', next_cycle_monthly_total: '149.98', active_subscriptions: [subscription] };

  it('preserves authoritative billing amounts, access dates, cycle and simulated catalog metadata', () => {
    service.getCatalog().subscribe();
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush({ ...sampleCatalogResource, cycle_days: 30, simulated_payment_available: true, activation_currency: 'PEN' });
    expect(service.catalog()?.cycle_days).toBe(30);
    expect(service.catalog()?.simulated_payment_available).toBe(true);
    service.getOverview('space-1').subscribe();
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1`).flush({ billing, space: null, account_quota: null });
    expect(service.overview()?.billing).toEqual(billing);
  });

  for (const kind of ['pro', 'extra']) {
    it(`refreshes overview then context only after a fulfilled simulated ${kind} activation`, () => {
      const payload = { currency: 'PEN', idempotency_key: 'same-key', confirm_simulated_payment: true };
      const request = kind === 'pro'
        ? service.createPlanChangeRequest({ ...payload, space_id: 'space-1', cellar_id: 'cellar-1', target_plan: 'PRO' })
        : service.createExtraSpaceRequest({ ...payload, quantity: 2 });
      request.subscribe();
      const post = http.expectOne(`${base}/api/v1/subscriptions/${kind === 'pro' ? 'plan-change-requests' : 'extra-space-requests'}`);
      expect(post.request.body.confirm_simulated_payment).toBe(true);
      expect(post.request.body.currency).toBe('PEN');
      expect(refreshContext).not.toHaveBeenCalled();
      post.flush({ status: 'FULFILLED', entitlements_applied: true, payment_mode: 'SIMULATED', subscription }, { status: 201, statusText: 'Created' });
      expect(refreshContext).not.toHaveBeenCalled();
      http.expectOne(req => req.url === `${base}/api/v1/subscriptions/overview`).flush({ billing, space: null });
      expect(service.overview()?.billing?.monthly_recurring_total).toBe('149.98');
      expect(refreshContext).toHaveBeenCalledOnce();
    });
  }

  it('keeps 202 pending without applying state or refreshing entitlements', () => {
    service.createExtraSpaceRequest({ currency: 'PEN', quantity: 1, idempotency_key: 'pending-key', confirm_simulated_payment: false }).subscribe();
    const post = http.expectOne(`${base}/api/v1/subscriptions/extra-space-requests`);
    expect(post.request.body.confirm_simulated_payment).toBe(false);
    post.flush({ status: 'PENDING_PAYMENT', entitlements_applied: false, payment_mode: 'NONE', subscription: null }, { status: 202, statusText: 'Accepted' });
    http.expectNone(req => req.url.includes('/overview'));
    expect(refreshContext).not.toHaveBeenCalled(); expect(service.overview()).toBeNull();
  });

  it('cancels at period end and uses server current/next totals without subtracting locally', () => {
    service.getOverview('space-1').subscribe();
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1`).flush({ billing, space: null });
    service.cancelSubscription('sub-1').subscribe();
    const post = http.expectOne(`${base}/api/v1/subscriptions/sub-1/cancel`);
    expect(post.request.method).toBe('POST'); expect(post.request.body).toEqual({});
    expect(service.overview()?.billing?.monthly_recurring_total).toBe('149.98');
    const cancelled = { ...subscription, cancel_at_period_end: true, auto_renews: false };
    post.flush(cancelled);
    expect(service.overview()?.billing?.next_cycle_monthly_total).toBe('149.98');
    http.expectOne(req => req.url.endsWith('/overview')).flush({ billing: { ...billing, next_cycle_monthly_total: '119.99', active_subscriptions: [cancelled] }, space: null });
    expect(service.overview()?.billing?.monthly_recurring_total).toBe('149.98');
    expect(service.overview()?.billing?.next_cycle_monthly_total).toBe('119.99');
    expect(service.overview()?.billing?.active_subscriptions[0].access_until).toBe(subscription.access_until);
    expect(refreshContext).toHaveBeenCalledOnce();
  });
});
