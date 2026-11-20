import { SpacePlan, SpaceRole, SpaceSubscriptionStatus, SpaceType } from '../../device/domain/model/valueobjects/space-access';
import { AccountQuota, SpaceQuotas } from './workspace-context';

export type SubscriptionCurrency = 'PEN' | 'USD' | (string & {});
export type SubscriptionBillingMode = 'PREPARATORY' | (string & {});
export type SubscriptionRequestKind = 'UPGRADE_PRO' | 'EXTRA_SPACE' | (string & {});
export type SubscriptionRequestStatus = 'PENDING_PAYMENT' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | (string & {});

export interface SubscriptionPrice {
  currency: SubscriptionCurrency;
  amount: string;
  billing_period?: string;
}

export interface SubscriptionPlanLimits {
  cellars: number | null;
  bottles: number | null;
  skus: number | null;
}

export interface SubscriptionCatalogPlan {
  purpose: SpaceType;
  tier: SpacePlan;
  prices: readonly SubscriptionPrice[];
  limits: SubscriptionPlanLimits;
  can_analyze: boolean;
}

export interface SubscriptionCatalogAddon {
  code: string;
  scope: string;
  unit?: string;
  prices: readonly SubscriptionPrice[];
}

export interface CourtesySpaces {
  COLLECTOR: number;
  BUSINESS: number;
}

export interface SubscriptionCatalog {
  version: string;
  billing_mode: SubscriptionBillingMode;
  plan_scope: string;
  courtesy_spaces: CourtesySpaces;
  plans: readonly SubscriptionCatalogPlan[];
  addons: readonly SubscriptionCatalogAddon[];
}

export interface SubscriptionOverviewCellar {
  id: string;
  name: string;
  space_id?: string;
  inherits_space_plan: boolean;
}

export interface SubscriptionOverviewSpace {
  id: string;
  name: string;
  purpose: SpaceType;
  subscription_plan: SpacePlan;
  subscription_status: SpaceSubscriptionStatus;
  role: SpaceRole;
  plan?: SubscriptionCatalogPlan | null;
  extra_cellars_allowance: number;
  can_manage_subscription: boolean;
  can_analyze: boolean;
  quotas: SpaceQuotas;
}

export interface SubscriptionOverview {
  billing_mode: SubscriptionBillingMode;
  account_quota: AccountQuota;
  space: SubscriptionOverviewSpace | null;
  cellar: SubscriptionOverviewCellar | null;
}

export interface SubscriptionRequestRecord {
  id: string;
  kind: SubscriptionRequestKind;
  status: SubscriptionRequestStatus;
  entitlement_scope: string;
  entitlements_applied: boolean;
  billing_mode?: SubscriptionBillingMode;
  space_id: string | null;
  cellar_id: string | null;
  target_plan: SpacePlan | null;
  currency: SubscriptionCurrency;
  quantity: number;
  unit_amount: string;
  total_amount: string;
  idempotency_key?: string;
  created_at: string;
}

export interface SubscriptionRequestsPage {
  items: readonly SubscriptionRequestRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreatePlanChangeRequestPayload {
  space_id: string;
  cellar_id: string | null;
  target_plan: 'PRO';
  currency: SubscriptionCurrency;
  idempotency_key: string;
}

export interface CreateExtraSpaceRequestPayload {
  currency: SubscriptionCurrency;
  quantity: number;
  idempotency_key: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asDecimalString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  return null;
};

export function normalizePrices(raw: unknown): SubscriptionPrice[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry): SubscriptionPrice | null => {
        const record = asRecord(entry);
        const currency = typeof record['currency'] === 'string' ? record['currency'].trim().toUpperCase() : '';
        const amount = asDecimalString(record['amount'] ?? record['monthly_amount'] ?? record['unit_amount']);
        if (!currency || amount === null) return null;
        const billingPeriod = typeof record['billing_period'] === 'string'
          ? record['billing_period']
          : typeof record['interval'] === 'string' ? record['interval'] : undefined;
        return billingPeriod ? { currency, amount, billing_period: billingPeriod } : { currency, amount };
      })
      .filter((item): item is SubscriptionPrice => item !== null);
  }
  const map = asRecord(raw);
  return Object.entries(map)
    .map(([key, value]): SubscriptionPrice | null => {
      const currency = key.trim().toUpperCase();
      if (!currency) return null;
      if (typeof value === 'string' || typeof value === 'number') {
        const amount = asDecimalString(value);
        return amount === null ? null : { currency, amount };
      }
      const record = asRecord(value);
      const amount = asDecimalString(record['amount'] ?? record['monthly_amount'] ?? record['unit_amount']);
      if (amount === null) return null;
      const billingPeriod = typeof record['billing_period'] === 'string'
        ? record['billing_period']
        : typeof record['interval'] === 'string' ? record['interval'] : undefined;
      return billingPeriod ? { currency, amount, billing_period: billingPeriod } : { currency, amount };
    })
    .filter((item): item is SubscriptionPrice => item !== null);
}

export function normalizeCatalogPlan(raw: unknown): SubscriptionCatalogPlan | null {
  const record = asRecord(raw);
  const purposeRaw = record['purpose'] ?? record['space_type'];
  const tierRaw = record['tier'] ?? record['plan'] ?? record['subscription_plan'];
  if ((purposeRaw !== 'COLLECTOR' && purposeRaw !== 'BUSINESS') || (tierRaw !== 'FREE' && tierRaw !== 'PRO')) {
    return null;
  }
  const limitsRaw = asRecord(record['limits']);
  return {
    purpose: purposeRaw,
    tier: tierRaw,
    prices: normalizePrices(record['prices'] ?? record['monthly_prices']),
    limits: {
      cellars: asNullableNumber(limitsRaw['cellars']),
      bottles: asNullableNumber(limitsRaw['bottles']),
      skus: asNullableNumber(limitsRaw['skus']),
    },
    can_analyze: Boolean(record['can_analyze'] ?? record['ai_analysis_enabled'] ?? record['ai_enabled'] ?? true),
  };
}

export function normalizeSubscriptionCatalog(raw: unknown): SubscriptionCatalog {
  const record = asRecord(raw);
  const plansRaw = Array.isArray(record['plans']) ? record['plans'] : [];
  const plans = plansRaw.map(normalizeCatalogPlan).filter((item): item is SubscriptionCatalogPlan => item !== null);

  let addons: SubscriptionCatalogAddon[] = [];
  if (Array.isArray(record['addons'])) {
    addons = record['addons']
      .map((entry): SubscriptionCatalogAddon | null => {
        const item = asRecord(entry);
        const code = typeof item['code'] === 'string' ? item['code'] : '';
        if (!code) return null;
        return {
          code,
          scope: typeof item['scope'] === 'string' ? item['scope'] : 'ACCOUNT',
          unit: typeof item['unit'] === 'string' ? item['unit'] : undefined,
          prices: normalizePrices(item['prices'] ?? item['monthly_prices']),
        };
      })
      .filter((item): item is SubscriptionCatalogAddon => item !== null);
  } else {
    addons = Object.entries(asRecord(record['addons'])).map(([code, entry]) => {
      const item = asRecord(entry);
      return {
        code: typeof item['code'] === 'string' ? item['code'] : code,
        scope: typeof item['scope'] === 'string' ? item['scope'] : 'ACCOUNT',
        unit: typeof item['unit'] === 'string' ? item['unit'] : undefined,
        prices: normalizePrices(item['prices'] ?? item['monthly_prices']),
      };
    });
  }

  const courtesyRaw = asRecord(record['courtesy_spaces']);
  return {
    version: typeof record['version'] === 'string' ? record['version'] : '',
    billing_mode: typeof record['billing_mode'] === 'string' ? record['billing_mode'] : 'PREPARATORY',
    plan_scope: typeof record['plan_scope'] === 'string' ? record['plan_scope'] : 'SPACE',
    courtesy_spaces: {
      COLLECTOR: typeof courtesyRaw['COLLECTOR'] === 'number' ? courtesyRaw['COLLECTOR'] : 0,
      BUSINESS: typeof courtesyRaw['BUSINESS'] === 'number' ? courtesyRaw['BUSINESS'] : 0,
    },
    plans,
    addons,
  };
}

function normalizeOverviewCellar(raw: unknown): SubscriptionOverviewCellar | null {
  const record = asRecord(raw);
  if (typeof record['id'] !== 'string' || !record['id']) return null;
  return {
    id: record['id'],
    name: typeof record['name'] === 'string' ? record['name'] : '',
    space_id: typeof record['space_id'] === 'string' ? record['space_id'] : undefined,
    inherits_space_plan: record['inherits_space_plan'] !== false,
  };
}

export function normalizeSubscriptionOverview(raw: unknown): SubscriptionOverview {
  const record = asRecord(raw);
  const spaceRaw = record['space'] ? asRecord(record['space']) : null;
  const cellar = normalizeOverviewCellar(record['cellar'] ?? spaceRaw?.['cellar']);
  let space: SubscriptionOverviewSpace | null = null;
  if (spaceRaw && typeof spaceRaw['id'] === 'string') {
    const purpose = (spaceRaw['purpose'] ?? spaceRaw['space_type']) as SpaceType;
    const subscriptionPlan = (spaceRaw['subscription_plan'] ?? 'FREE') as SpacePlan;
    const subscriptionStatus = (spaceRaw['subscription_status'] ?? 'ACTIVE') as SpaceSubscriptionStatus;
    const role = spaceRaw['role'] as SpaceRole;
    space = {
      id: spaceRaw['id'],
      name: typeof spaceRaw['name'] === 'string' ? spaceRaw['name'] : '',
      purpose,
      subscription_plan: subscriptionPlan,
      subscription_status: subscriptionStatus,
      role,
      plan: spaceRaw['plan'] ? normalizeCatalogPlan(spaceRaw['plan']) : null,
      extra_cellars_allowance: typeof spaceRaw['extra_cellars_allowance'] === 'number' ? spaceRaw['extra_cellars_allowance'] : 0,
      can_manage_subscription: Boolean(spaceRaw['can_manage_subscription']),
      can_analyze: Boolean(spaceRaw['can_analyze']),
      quotas: spaceRaw['quotas'] as SpaceQuotas,
    };
  }
  return {
    billing_mode: typeof record['billing_mode'] === 'string' ? record['billing_mode'] : 'PREPARATORY',
    account_quota: record['account_quota'] as AccountQuota,
    space,
    cellar,
  };
}

export function normalizeSubscriptionRequest(raw: unknown): SubscriptionRequestRecord {
  const record = asRecord(raw);
  return {
    id: String(record['id'] ?? ''),
    kind: String(record['kind'] ?? ''),
    status: String(record['status'] ?? 'PENDING_PAYMENT'),
    entitlement_scope: String(record['entitlement_scope'] ?? (record['kind'] === 'EXTRA_SPACE' ? 'ACCOUNT' : 'SPACE')),
    entitlements_applied: Boolean(record['entitlements_applied']),
    billing_mode: typeof record['billing_mode'] === 'string' ? record['billing_mode'] : undefined,
    space_id: typeof record['space_id'] === 'string' ? record['space_id'] : null,
    cellar_id: typeof record['cellar_id'] === 'string' ? record['cellar_id'] : null,
    target_plan: record['target_plan'] === 'PRO' || record['target_plan'] === 'FREE' ? record['target_plan'] : null,
    currency: typeof record['currency'] === 'string' ? record['currency'].toUpperCase() : '',
    quantity: typeof record['quantity'] === 'number' && Number.isInteger(record['quantity']) ? record['quantity'] : 1,
    unit_amount: asDecimalString(record['unit_amount']) ?? '0.00',
    total_amount: asDecimalString(record['total_amount'] ?? record['unit_amount']) ?? '0.00',
    idempotency_key: typeof record['idempotency_key'] === 'string' ? record['idempotency_key'] : undefined,
    created_at: typeof record['created_at'] === 'string' ? record['created_at'] : '',
  };
}

export function normalizeSubscriptionRequestsPage(raw: unknown, fallbackLimit = 20, fallbackOffset = 0): SubscriptionRequestsPage {
  if (Array.isArray(raw)) {
    const items = raw.map(normalizeSubscriptionRequest);
    return { items, total: items.length, limit: fallbackLimit, offset: fallbackOffset };
  }
  const record = asRecord(raw);
  const list = Array.isArray(record['items'])
    ? record['items']
    : Array.isArray(record['requests'])
      ? record['requests']
      : [];
  const items = list.map(normalizeSubscriptionRequest);
  return {
    items,
    total: typeof record['total'] === 'number' ? record['total'] : items.length,
    limit: typeof record['limit'] === 'number' ? record['limit'] : fallbackLimit,
    offset: typeof record['offset'] === 'number' ? record['offset'] : fallbackOffset,
  };
}

export function findCatalogPlan(
  catalog: SubscriptionCatalog | null | undefined,
  purpose: SpaceType | null | undefined,
  tier: SpacePlan
): SubscriptionCatalogPlan | null {
  if (!catalog || !purpose) return null;
  return catalog.plans.find((plan) => plan.purpose === purpose && plan.tier === tier) ?? null;
}

export function findCatalogAddon(
  catalog: SubscriptionCatalog | null | undefined,
  code: string
): SubscriptionCatalogAddon | null {
  if (!catalog) return null;
  return catalog.addons.find((addon) => addon.code === code) ?? null;
}

/** Never perform client-side FX conversions; preserve the exact server decimal string and currency. */
export function formatSubscriptionMoney(amount: string, currency: string): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  const normalizedAmount = amount.trim();
  if (normalizedCurrency === 'PEN') return `S/ ${normalizedAmount} PEN`;
  if (normalizedCurrency === 'USD') return `$ ${normalizedAmount} USD`;
  return `${normalizedAmount} ${normalizedCurrency}`.trim();
}

export function formatQuotedMonthly(amount: string, currency: string): string {
  return `${amount.trim()} ${currency.trim().toUpperCase()}/mes`;
}

export function generateIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
