import { WineInventoryItem } from '../../../../inventory/domain/services/wine-inventory-item-query-service';

/** Display-only cost; exact cents avoid floating-point drift and never infer a currency. */
export function inventoryCost(items: readonly WineInventoryItem[]): { value: string | null; missingPrices: number } {
  let cents = 0n;
  let known = 0;
  let missingPrices = 0;
  for (const item of items) {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(item.purchasePrice?.trim() ?? '');
    if (!match || !Number.isSafeInteger(item.quantity) || item.quantity < 0) {
      if (item.quantity > 0) missingPrices++;
      continue;
    }
    known++;
    cents += (BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))) * BigInt(item.quantity);
  }
  return { value: known ? `${new Intl.NumberFormat('es-PE').format(cents / 100n)}.${String(cents % 100n).padStart(2, '0')}` : null, missingPrices };
}
