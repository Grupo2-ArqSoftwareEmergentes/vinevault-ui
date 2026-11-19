import { inventoryCost } from './overview-inventory-cost';
import { WineInventoryItem } from '../../../../inventory/domain/services/wine-inventory-item-query-service';

const item: WineInventoryItem = { id: { value: 'item-1' }, wineCellarId: { value: 'cellar-1' }, name: 'Vino', quantity: 3, createdAt: null, updatedAt: null };
describe('Inventory executive cost', () => {
  it('uses exact cents times stock without floating point drift or an invented currency', () => {
    expect(inventoryCost([{ ...item, purchasePrice: '0.10' }])).toEqual({ value: '0.30', missingPrices: 0 });
  });
  it('distinguishes missing cost from a known zero', () => {
    expect(inventoryCost([item])).toEqual({ value: null, missingPrices: 1 });
    expect(inventoryCost([{ ...item, purchasePrice: '0.00' }])).toEqual({ value: '0.00', missingPrices: 0 });
    expect(inventoryCost([])).toEqual({ value: null, missingPrices: 0 });
  });
  it('marks partial totals while excluding missing prices on zero-stock references', () => {
    expect(inventoryCost([{ ...item, purchasePrice: '10.25' }, item, { ...item, quantity: 0 }])).toEqual({ value: '30.75', missingPrices: 1 });
  });
});
