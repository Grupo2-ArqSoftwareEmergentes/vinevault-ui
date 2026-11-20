import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../../api.config';
import { SubscriptionApiService } from './subscription-api.service';
import { WorkspaceScopeService } from './workspace-scope.service';
import { formatQuotedMonthly, formatSubscriptionMoney, generateIdempotencyKey } from '../models/subscription';
import { sampleCatalogResource } from '../testing/workspace.fixtures';

const base = API_CONFIG.baseUrl;

describe('SubscriptionApiService', () => {
  let service: SubscriptionApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
});
