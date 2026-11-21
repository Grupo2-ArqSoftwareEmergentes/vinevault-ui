export const ownerAccess = { spaceType: 'COLLECTOR', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE', role: 'OWNER' } as const;
export const ownerResourceAccess = { space_type: 'COLLECTOR', subscription_plan: 'FREE', subscription_status: 'ACTIVE', role: 'OWNER' } as const;
/** Explicit server capability fixtures; application code has no plan matrix. */
export const enabledPlanFeatures = { autocomplete: true, assistant_chat: true, stock_analysis: true, sommelier_analysis: true, excel_export: true, pdf_report: true } as const;
export const freePlanFeatures = { autocomplete: false, assistant_chat: false, stock_analysis: false, sommelier_analysis: false, excel_export: true, pdf_report: false } as const;

export const sampleCatalogResource = {
  version: '2026-11-19',
  billing_mode: 'PREPARATORY',
  plan_scope: 'SPACE',
  courtesy_spaces: { COLLECTOR: 1, BUSINESS: 1 },
  plans: [
    {
      purpose: 'COLLECTOR',
      tier: 'FREE',
      features: freePlanFeatures,
      prices: [{ currency: 'USD', amount: '0.00' }, { currency: 'PEN', amount: '0.00' }],
      limits: { cellars: 1, bottles: 50, skus: null },
      can_analyze: false,
    },
    {
      purpose: 'BUSINESS',
      tier: 'FREE',
      features: freePlanFeatures,
      prices: [{ currency: 'USD', amount: '0.00' }, { currency: 'PEN', amount: '0.00' }],
      limits: { cellars: 1, bottles: null, skus: 25 },
      can_analyze: false,
    },
    {
      purpose: 'COLLECTOR',
      tier: 'PRO',
      features: enabledPlanFeatures,
      prices: [{ currency: 'PEN', amount: '29.99' }],
      limits: { cellars: 3, bottles: null, skus: null },
      can_analyze: true,
    },
    {
      purpose: 'BUSINESS',
      tier: 'PRO',
      features: enabledPlanFeatures,
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
