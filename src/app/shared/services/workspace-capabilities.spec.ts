import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceScopeService } from './workspace-scope.service';
import { SubscriptionApiService } from './subscription-api.service';
import { sampleCatalogResource, ownerAccess, enabledPlanFeatures, freePlanFeatures } from '../testing/workspace.fixtures';
import { apiUrl } from '../../api.config';
import { inventoryQuotaProjection } from './workspace-quota';

describe('Server-owned capabilities of the selected space', () => {
  let access: WorkspaceAccessService;
  let scope: WorkspaceScopeService;
  let subscriptions: SubscriptionApiService;
  let http: HttpTestingController;
  const quotas = (limit: number | null, used = 60) => ({ cellars: { used: 4, limit: 1, remaining: 0 }, bottles: { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) }, skus: { used: 30, limit: null, remaining: null } });
  const select = (id: string, plan: 'FREE' | 'PRO' = 'FREE') => scope.activate({ ...ownerAccess, id: { value: id }, name: id, subscriptionPlan: plan, quotas: quotas(50) });
  function overview(id: string, plan: 'FREE' | 'PRO', extra = {}) {
    subscriptions.getOverview(id).subscribe();
    http.expectOne(apiUrl('/api/v1/subscriptions/overview') + '?space_id=' + id).flush({ space: {
      id, name: id, purpose: 'COLLECTOR', subscription_plan: plan, subscription_status: 'ACTIVE', role: 'OWNER', can_manage_subscription: true,
      plan: { ...sampleCatalogResource.plans.find(p => p.purpose === 'COLLECTOR' && p.tier === plan) }, quotas: quotas(plan === 'PRO' ? null : 50), ...extra,
    } });
  }
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    access = TestBed.inject(WorkspaceAccessService); scope = TestBed.inject(WorkspaceScopeService);
    subscriptions = TestBed.inject(SubscriptionApiService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('does not invent capabilities from a PRO flag or missing server metadata', () => {
    select('one', 'PRO');
    expect(access.hasFeature('autocomplete')).toBe(false);
    expect(access.hasFeature('pdf_report')).toBe(false);
  });
  it('reads catalog features and drops PRO capabilities immediately on space switch', () => {
    subscriptions.getCatalog().subscribe(); http.expectOne(apiUrl('/api/v1/subscriptions/catalog')).flush(sampleCatalogResource);
    select('pro', 'PRO'); overview('pro', 'PRO');
    expect(access.hasFeature('assistant_chat')).toBe(true);
    select('free');
    expect(access.hasFeature('assistant_chat')).toBe(false);
    expect(access.hasFeature('excel_export')).toBe(true);
    expect(access.quotas()?.bottles.limit).toBe(50);
  });
  it('applies server activation, retains cancelled benefits, then uses FREE on server expiry without deleting data', () => {
    select('one'); overview('one', 'PRO');
    expect(access.hasFeature('autocomplete')).toBe(true);
    expect(access.quotas()?.bottles.limit).toBeNull();
    overview('one', 'PRO', { active_subscription: { id: 'paid', status: 'ACTIVE', cancel_at_period_end: true, access_until: '2000-01-01T00:00:00Z' } });
    // Even a date in the past does not let the client reinterpret the backend plan.
    expect(access.hasFeature('pdf_report')).toBe(true);
    overview('one', 'FREE');
    expect(access.hasFeature('pdf_report')).toBe(false);
    expect(access.canInventory()).toBe(true);
    expect(access.canCreateCellar()).toBe(false);
    expect(access.quotas()?.bottles.used).toBe(60);
    expect(inventoryQuotaProjection(access.effectiveSpace(), 8, 10, true)?.exceeded).toBe(false);
    expect(inventoryQuotaProjection(access.effectiveSpace(), 10, 10, true)?.exceeded).toBe(false);
    expect(inventoryQuotaProjection(access.effectiveSpace(), 11, 10, true)?.exceeded).toBe(true);
  });
  it('keeps role checks independent of paid features and subscription management flags', () => {
    select('one', 'PRO'); overview('one', 'PRO', { role: 'WAITER', can_manage_subscription: true, can_analyze: true });
    expect(access.hasFeature('assistant_chat')).toBe(false);
    expect(access.hasFeature('autocomplete')).toBe(false);
    expect(access.canInventory()).toBe(false);
    expect(access.canManageSubscription()).toBe(false);
    expect(access.hasFeature('pdf_report')).toBe(true);
  });
  it('honors feature flags rather than assuming every PRO feature is enabled', () => {
    select('one', 'PRO'); overview('one', 'PRO', { plan: { purpose: 'COLLECTOR', tier: 'PRO', features: { ...enabledPlanFeatures, autocomplete: false } } });
    expect(access.hasFeature('autocomplete')).toBe(false);
    expect(access.hasFeature('assistant_chat')).toBe(true);
    overview('one', 'FREE', { plan: { purpose: 'COLLECTOR', tier: 'FREE', features: freePlanFeatures } });
    expect(access.hasFeature('assistant_chat')).toBe(false);
  });
  it('synchronizes catalog and overview from the root, cancels stale reads and clears capabilities on logout', async () => {
    TestBed.runInInjectionContext(() => subscriptions.connectWorkspace());
    select('one'); TestBed.tick();
    const catalog = http.expectOne(apiUrl('/api/v1/subscriptions/catalog'));
    const old = http.expectOne(apiUrl('/api/v1/subscriptions/overview') + '?space_id=one');
    catalog.flush(sampleCatalogResource);
    select('two'); TestBed.tick();
    expect(old.cancelled).toBe(true);
    http.expectOne(apiUrl('/api/v1/subscriptions/overview') + '?space_id=two').flush({ space: { id: 'two', purpose: 'COLLECTOR', subscription_plan: 'FREE', role: 'OWNER', plan: sampleCatalogResource.plans[0] } });
    expect(access.hasFeature('pdf_report')).toBe(false);
    scope.invalidateSession(); TestBed.tick();
    expect(subscriptions.catalog()).toBeNull();
    expect(access.hasFeature('excel_export')).toBe(false);
  });
});
