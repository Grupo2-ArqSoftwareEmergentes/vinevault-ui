import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_CONFIG } from '../../api.config';
import { SubscriptionApiService } from './subscription-api.service';
import { WorkspaceContextService } from './workspace-context.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WORKSPACE_SELECTION_STORAGE_KEY } from './workspace-context.service';

const base = API_CONFIG.baseUrl;
const quota = (used: number, limit: number | null) => ({ used, limit, remaining: limit === null ? null : limit - used });
const quotas = (pro: boolean) => ({ cellars: quota(1, pro ? 3 : 1), bottles: quota(50, pro ? null : 50), skus: quota(25, pro ? null : 25) });
const space = (pro: boolean) => ({ id: 'space-1', name: 'Home', space_type: 'COLLECTOR', subscription_plan: pro ? 'PRO' : 'FREE', subscription_status: 'ACTIVE', role: 'OWNER', quotas: quotas(pro) });
const context = (pro: boolean) => ({ spaces: [space(pro)], wine_cellars: [{ id: 'cellar-1', name: 'Cava', space_id: 'space-1' }], account_quota: { extra_spaces_allowance: 0, current_spaces: 1, max_spaces: 2, remaining_spaces: 1, can_create_collector: false, can_create_business: true } });
const active = { id: 'subscription-1', kind: 'UPGRADE_PRO', status: 'ACTIVE', currency: 'PEN', monthly_amount: '29.99', quantity: 1, space_id: 'space-1', access_until: '2026-12-20T00:00:00Z', current_period_end: '2026-12-20T00:00:00Z', cancel_at_period_end: false, auto_renews: true };
const overview = (pro: boolean, cancelled = false) => ({ space: { ...space(pro), purpose: 'COLLECTOR', can_manage_subscription: true }, account_quota: context(pro).account_quota, billing: { currency: 'PEN', cycle_days: 30, monthly_recurring_total: pro ? '29.99' : '0.00', next_cycle_monthly_total: pro && !cancelled ? '29.99' : '0.00', active_subscriptions: pro ? [{ ...active, cancel_at_period_end: cancelled }] : [] } });

describe('Subscription activation and real workspace quotas', () => {
  beforeEach(() => {
    localStorage.removeItem(WORKSPACE_SELECTION_STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); localStorage.removeItem(WORKSPACE_SELECTION_STORAGE_KEY); });

  it('unlocks only from server overview/context, preserves PRO until server expiry, then restores effective FREE limits', () => {
    const http = TestBed.inject(HttpTestingController);
    const workspace = TestBed.inject(WorkspaceContextService);
    const access = TestBed.inject(WorkspaceAccessService);
    const api = TestBed.inject(SubscriptionApiService);
    workspace.ensureLoaded();
    http.expectOne(`${base}/api/v1/user/context`).flush(context(false));
    expect(access.plan()).toBe('FREE');

    api.createPlanChangeRequest({ space_id: 'space-1', cellar_id: 'cellar-1', target_plan: 'PRO', currency: 'PEN', idempotency_key: 'action-1', confirm_simulated_payment: true }).subscribe();
    http.expectOne(`${base}/api/v1/subscriptions/plan-change-requests`).flush({ status: 'FULFILLED', entitlements_applied: true, payment_mode: 'SIMULATED', subscription: active }, { status: 201, statusText: 'Created' });
    expect(access.plan()).toBe('FREE');
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1&cellar_id=cellar-1`).flush(overview(true));
    expect(access.plan()).toBe('PRO');
    expect(workspace.selection().space?.subscriptionPlan).toBe('FREE');
    http.expectOne(`${base}/api/v1/user/context`).flush(context(true));
    expect(access.plan()).toBe('PRO');
    expect(access.space()?.quotas?.cellars.limit).toBe(3);
    expect(access.space()?.quotas?.bottles.limit).toBeNull();
    expect(access.space()?.quotas?.skus.limit).toBeNull();

    api.cancelSubscription(active.id).subscribe();
    http.expectOne(`${base}/api/v1/subscriptions/subscription-1/cancel`).flush({ ...active, cancel_at_period_end: true });
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1`).flush(overview(true, true));
    http.expectOne(`${base}/api/v1/user/context`).flush(context(true));
    expect(access.plan()).toBe('PRO');
    expect(api.overview()?.billing?.monthly_recurring_total).toBe('29.99');
    expect(api.overview()?.billing?.next_cycle_monthly_total).toBe('0.00');

    api.refreshState();
    http.expectOne(`${base}/api/v1/subscriptions/overview?space_id=space-1`).flush(overview(false));
    http.expectOne(`${base}/api/v1/user/context`).flush(context(false));
    expect(access.plan()).toBe('FREE');
    expect(access.space()?.quotas?.cellars.limit).toBe(1);
    expect(access.space()?.quotas?.bottles.limit).toBe(50);
    expect(api.overview()?.billing?.active_subscriptions).toEqual([]);
  });
});
