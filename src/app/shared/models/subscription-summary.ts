import { SubscriptionCatalog, findCatalogAddon, findCatalogPlan } from './subscription';
import { AccountQuota, WorkspaceSpace } from './workspace-context';

/** Sum PEN catalog tariffs in integer cents, never convert currencies or pending intents. */
export function monthlyPenCents(prices: readonly { currency: string; amount: string; billing_period?: string }[] | undefined): number | null {
  const price = prices?.find(p => p.currency === 'PEN' && (!p.billing_period || ['month', 'monthly'].includes(p.billing_period.toLowerCase())));
  if (!price || !/^\d+(\.\d{1,2})?$/.test(price.amount)) return null;
  const [whole, fraction = ''] = price.amount.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function recurringSpaceCents(space: WorkspaceSpace, catalog: SubscriptionCatalog | null): number | null {
  if (space.subscriptionPlan === 'FREE' || space.subscriptionStatus === 'EXPIRED') return 0;
  if (space.subscriptionPlan !== 'PRO' || space.subscriptionStatus !== 'ACTIVE') return null;
  return monthlyPenCents(findCatalogPlan(catalog, space.spaceType, 'PRO')?.prices);
}

export function subscriptionMonthlySummary(spaces: readonly WorkspaceSpace[], quota: AccountQuota | null, catalog: SubscriptionCatalog | null) {
  const extra = quota?.extra_spaces_allowance ?? null;
  const included = quota && Number.isInteger(quota.max_spaces) && extra !== null ? quota.max_spaces - extra : null;
  const amounts = spaces.map(space => recurringSpaceCents(space, catalog));
  const addonUnit = monthlyPenCents(findCatalogAddon(catalog, 'EXTRA_SPACE')?.prices);
  const addonCents = extra === 0 ? 0 : extra !== null && addonUnit !== null ? extra * addonUnit : null;
  const totalCents = addonCents !== null && amounts.every(amount => amount !== null)
    ? amounts.reduce<number>((sum, amount) => sum + amount!, 0) + addonCents : null;
  return { extra, included, addonCents, totalCents };
}

export const formatPenCents = (cents: number | null): string => cents === null ? 'No disponible' : `S/ ${(cents / 100).toFixed(2)}`;

/** Non-PEN historical quotes remain unknown; never relabel or convert them to soles. */
export function formatSolesMoney(amount: string, currency: string): string {
  const cents = monthlyPenCents([{ amount, currency }]);
  return cents === null ? 'Importe en soles no disponible' : formatPenCents(cents);
}

export function formatSolesMonthly(amount: string, currency: string): string {
  const money = formatSolesMoney(amount, currency);
  return money.startsWith('S/') ? `${money} / mes` : money;
}
