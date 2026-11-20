export const ownerAccess = { spaceType: 'COLLECTOR', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'OWNER' } as const;
export const ownerResourceAccess = { space_type: 'COLLECTOR', subscription_plan: 'FREE', subscription_status: 'ACTIVE', role: 'OWNER' } as const;

export const sampleCatalogResource = {
  version: '2026-11-19',
  billing_mode: 'PREPARATORY',
  plan_scope: 'SPACE',
  courtesy_spaces: { COLLECTOR: 1, BUSINESS: 1 },
  plans: [
    {
      purpose: 'COLLECTOR',
      tier: 'FREE',
      prices: [{ currency: 'USD', amount: '0.00' }, { currency: 'PEN', amount: '0.00' }],
      limits: { cellars: 1, bottles: 50, skus: null },
      can_analyze: true,
    },
    {
      purpose: 'BUSINESS',
      tier: 'FREE',
      prices: [{ currency: 'USD', amount: '0.00' }, { currency: 'PEN', amount: '0.00' }],
      limits: { cellars: 1, bottles: null, skus: 25 },
      can_analyze: true,
    },
    {
      purpose: 'COLLECTOR',
      tier: 'PRO',
      prices: [{ currency: 'PEN', amount: '29.99' }],
      limits: { cellars: 3, bottles: null, skus: null },
      can_analyze: true,
    },
    {
      purpose: 'BUSINESS',
      tier: 'PRO',
      prices: [{ currency: 'PEN', amount: '79.99' }],
      limits: { cellars: 3, bottles: null, skus: null },
      can_analyze: true,
    },
  ],
  addons: [
    {
      code: 'EXTRA_SPACE',
      scope: 'ACCOUNT',
      unit: 'SPACE_SLOT',
      prices: [{ currency: 'USD', amount: '5.00' }, { currency: 'PEN', amount: '20.00' }],
    },
  ],
};
