/** Display server decimal strings only. No sums, multiplication or currency conversions. */
export function formatSolesMoney(amount: string | null | undefined, currency: string): string {
  if (currency !== 'PEN' || typeof amount !== 'string' || !/^\d+(\.\d{1,2})?$/.test(amount)) return 'Importe en soles no disponible';
  const [whole, fraction = ''] = amount.split('.');
  return `S/ ${whole}.${fraction.padEnd(2, '0')}`;
}

export function formatSolesMonthly(amount: string | null | undefined, currency: string): string {
  const money = formatSolesMoney(amount, currency);
  return money.startsWith('S/') ? `${money} / mes` : money;
}
