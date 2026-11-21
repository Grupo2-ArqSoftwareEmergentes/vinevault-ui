import { HttpErrorResponse } from '@angular/common/http';
import { AccountQuota, WorkspaceSpace } from '../models/workspace-context';
import { ownerAccess } from '../testing/workspace.fixtures';
import { canCreateCellar, canCreateSpace, inventoryQuotaProjection, quotaErrorDetail } from './workspace-quota';

const account: AccountQuota = { extra_spaces_allowance: 0, current_spaces: 1, max_spaces: 2, remaining_spaces: 1, can_create_collector: false, can_create_business: true };
const space: WorkspaceSpace = {
  ...ownerAccess, id: { value: 'space-1' }, name: 'Whole space',
  extra_cellars_allowance: 0,
  quotas: { cellars: { used: 1, limit: 1, remaining: 0 }, bottles: { used: 49, limit: 50, remaining: 1 }, skus: { used: 25, limit: 25, remaining: 0 } },
};

describe('Authoritative quota projections', () => {
  it('uses account purpose capabilities, not only remaining_spaces or the selected space', () => {
    expect(canCreateSpace(account, 'COLLECTOR')).toBe(false);
    expect(canCreateSpace(account, 'BUSINESS')).toBe(true);
    expect(canCreateSpace({ ...account, remaining_spaces: 0 }, 'BUSINESS')).toBe(true);
  });
  it('counts the automatic principal cellar and combines capacity with role', () => {
    expect(canCreateCellar(space)).toBe(false);
    const extended = { ...space, extra_cellars_allowance: 1, quotas: { ...space.quotas!, cellars: { used: 1, limit: 2, remaining: 1 } } };
    expect(canCreateCellar(extended)).toBe(true);
    expect(canCreateCellar({ ...extended, role: 'WAITER' })).toBe(false);
    expect(canCreateCellar({ ...extended, role: 'SOMMELIER' })).toBe(true);
  });
  it('projects Collector bottles using whole-space used, not a visible cellar count', () => {
    expect(inventoryQuotaProjection(space, 2, 0, false)).toEqual(expect.objectContaining({ projected: 51, exceeded: true }));
    expect(inventoryQuotaProjection(space, 4, 3, true)).toEqual(expect.objectContaining({ projected: 50, exceeded: false }));
    expect(inventoryQuotaProjection(space, 5, 3, true)?.exceeded).toBe(true);
    expect(inventoryQuotaProjection(space, 0, 3, true)?.projected).toBe(46);
  });
  it('counts Business records even with zero stock; editing never adds a SKU', () => {
    const business = { ...space, spaceType: 'BUSINESS' as const };
    expect(inventoryQuotaProjection(business, 0, 0, false)).toEqual(expect.objectContaining({ projected: 26, exceeded: true }));
    expect(inventoryQuotaProjection(business, 999, 0, true)).toEqual(expect.objectContaining({ projected: 25, exceeded: false }));
  });
  it('treats PRO null limits as unlimited and allows correcting already-over-limit stock', () => {
    const pro = { ...space, subscriptionPlan: 'PRO' as const, quotas: {
      cellars: { used: 100, limit: null, remaining: null }, bottles: { used: 5000, limit: null, remaining: null }, skus: { used: 1000, limit: null, remaining: null },
    } };
    expect(canCreateCellar(pro)).toBe(true);
    expect(inventoryQuotaProjection(pro, 100000, 0, false)?.exceeded).toBe(false);
    expect(inventoryQuotaProjection({ ...pro, spaceType: 'BUSINESS' }, 0, 0, false)?.exceeded).toBe(false);
    const over = { ...space, quotas: { ...space.quotas!, bottles: { used: 60, limit: 50, remaining: 0 } } };
    expect(inventoryQuotaProjection(over, 4, 5, true)?.exceeded).toBe(false);
    expect(inventoryQuotaProjection(over, 5, 5, true)?.exceeded).toBe(false);
    expect(inventoryQuotaProjection(over, 6, 5, true)?.exceeded).toBe(true);
  });
  for (const code of ['SPACE_LIMIT_REACHED', 'CELLAR_LIMIT_REACHED', 'ITEM_LIMIT_REACHED']) {
    it(`distinguishes ${code} from an authorization rejection`, () => {
      expect(quotaErrorDetail(new HttpErrorResponse({ status: 403, error: { detail: { code, message: 'Mensaje del servidor' } } }))).toEqual({ code, message: 'Mensaje del servidor' });
      expect(quotaErrorDetail(new HttpErrorResponse({ status: 401, error: { detail: { code } } }))).toBeNull();
    });
  }
  it('does not classify a generic 403 as quota failure or invent missing limits', () => {
    expect(quotaErrorDetail(new HttpErrorResponse({ status: 403, error: { detail: 'Forbidden' } }))).toBeNull();
    expect(inventoryQuotaProjection({ ...space, quotas: undefined }, 5, 0, false)).toBeNull();
  });
});
