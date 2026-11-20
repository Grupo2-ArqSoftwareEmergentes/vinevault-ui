import { describe, it, expect } from 'vitest';
import { formatSolesMoney, formatSolesMonthly } from './subscription-summary';

describe('Server subscription amount display', () => {
  it('formats exact server strings without Number conversion, sums or price multiplication', () => {
    expect(formatSolesMoney('20', 'PEN')).toBe('S/ 20.00');
    expect(formatSolesMonthly('79.99', 'PEN')).toBe('S/ 79.99 / mes');
    expect(formatSolesMonthly('29.99', 'PEN')).toBe('S/ 29.99 / mes');
    expect(formatSolesMoney('9007199254740993.99', 'PEN')).toBe('S/ 9007199254740993.99');
  });
  it('does not fabricate a zero or convert another currency when billing data is missing', () => {
    expect(formatSolesMonthly('5.00', 'USD')).toBe('Importe en soles no disponible');
    expect(formatSolesMoney('invalid', 'PEN')).toBe('Importe en soles no disponible');
    expect(formatSolesMoney(null, 'PEN')).toBe('Importe en soles no disponible');
  });
});
