import { describe, it, expect } from 'vitest';
import { normalizeSubscriptionCatalog } from './subscription';
import { monthlyPenCents, recurringSpaceCents, subscriptionMonthlySummary, formatPenCents } from './subscription-summary';
import { AccountQuota, WorkspaceSpace } from './workspace-context';
import { sampleCatalogResource } from '../testing/workspace.fixtures';

const catalog = normalizeSubscriptionCatalog(sampleCatalogResource);
const quota: AccountQuota = { current_spaces: 4, max_spaces: 4, extra_spaces_allowance: 2, remaining_spaces: 0, can_create_business: true, can_create_collector: true };
const space = (id: string, overrides: Partial<WorkspaceSpace> = {}): WorkspaceSpace => ({ id: { value: id }, name: id, role: 'OWNER', spaceType: 'COLLECTOR', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', ...overrides });

describe('Subscription recurring monthly summary', () => {
  it('sums active Business/Collector Pro and confirmed extra slots exactly in PEN cents', () => {
    const spaces = [space('business', { spaceType: 'BUSINESS' }), space('collector'), space('free', { subscriptionPlan: 'FREE' }), space('expired', { subscriptionStatus: 'EXPIRED' })];
    const result = subscriptionMonthlySummary(spaces, quota, catalog);
    expect(result).toEqual({ included: 2, extra: 2, addonCents: 4000, totalCents: 14998 });
    expect(formatPenCents(result.totalCents)).toBe('S/ 149.98');
  });
  it('returns zero for a free account with no extra slots, not a fabricated paid subscription', () => {
    expect(subscriptionMonthlySummary([space('free', { subscriptionPlan: 'FREE' })], { ...quota, extra_spaces_allowance: 0, max_spaces: 2 }, catalog).totalCents).toBe(0);
  });
  it('keeps missing account, status, plan or required tariffs unknown instead of reporting a misleading zero', () => {
    expect(subscriptionMonthlySummary([space('a')], null, catalog).totalCents).toBeNull();
    expect(recurringSpaceCents(space('a', { subscriptionPlan: null }), catalog)).toBeNull();
    expect(recurringSpaceCents(space('a', { subscriptionStatus: null }), catalog)).toBeNull();
    expect(subscriptionMonthlySummary([space('a')], quota, null).totalCents).toBeNull();
    expect(formatPenCents(null)).toBe('No disponible');
  });
  it('uses a server PEN tariff and never converts USD or an annual price into a monthly amount', () => {
    expect(monthlyPenCents([{ currency: 'USD', amount: '5.00' }])).toBeNull();
    expect(monthlyPenCents([{ currency: 'PEN', amount: '20.00', billing_period: 'yearly' }])).toBeNull();
    expect(monthlyPenCents([{ currency: 'PEN', amount: '21.50' }])).toBe(2150);
    expect(monthlyPenCents([{ currency: 'PEN', amount: 'invalid' }])).toBeNull();
  });
});
