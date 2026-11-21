import { normalizeCatalogPlan } from '../../../models/subscription';
import { proBenefits } from './pro-benefits';

describe('Server catalog benefits', () => {
  it('does not advertise unlimited quotas or unavailable product features when metadata is missing', () => {
    const plan = normalizeCatalogPlan({ purpose: 'COLLECTOR', tier: 'PRO' });
    expect(plan?.limits.cellars).toBeUndefined();
    expect(plan?.limits.bottles).toBeUndefined();
    expect(proBenefits('COLLECTOR', plan)).toEqual([]);
  });
  it('preserves explicit null as unlimited and advertises only explicit server feature flags', () => {
    const plan = normalizeCatalogPlan({ purpose: 'BUSINESS', tier: 'PRO', limits: { cellars: 4, skus: null }, features: { pdf_report: true, autocomplete: false } });
    expect(plan?.limits.skus).toBeNull();
    const benefits = proBenefits('BUSINESS', plan).join(' ');
    expect(benefits).toContain('4 almacenes/cavas');
    expect(benefits).toContain('SKUs sin límite');
    expect(benefits).toContain('PDF');
    expect(benefits).not.toMatch(/Autocompletado|Multiusuario|QR|rotación/);
  });
});
