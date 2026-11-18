import { WineDetails } from '../../../domain/model/wine-details';
import { WineDetailsResource } from '../resources/wine-details.resource';
import { CreateWineInventoryItemPayload, UpdateWineInventoryItemPayload } from '../../../domain/services/wine-inventory-item-command-service';
import { CreateWineInventoryItemResource, UpdateWineInventoryItemResource } from '../resources/create-wine-inventory-item.resource';

export const wineDetailKeys = {
  winery: 'winery', vintage: 'vintage', physicalLocation: 'physical_location',
  country: 'country', region: 'region', appellation: 'appellation', wineType: 'wine_type',
  bottleFormat: 'bottle_format', aging: 'aging', alcoholPercentage: 'alcohol_percentage',
  consumptionWindow: 'consumption_window', purchasePrice: 'purchase_price', salePrice: 'sale_price',
  minStockAlert: 'min_stock_alert', supplierName: 'supplier_name', originType: 'origin_type',
  purchaseDate: 'purchase_date', batchInvoiceNumber: 'batch_invoice_number', rating: 'rating',
  bodySlider: 'body_slider', aciditySlider: 'acidity_slider', tanninsSlider: 'tannins_slider',
  aromaTags: 'aroma_tags', occasionNotes: 'occasion_notes', tastingNotes: 'tasting_notes', companyNotes: 'company_notes',
  wouldBuyAgain: 'would_buy_again', ageYears: 'age_years',
} as const satisfies Record<keyof WineDetails, keyof WineDetailsResource>;

export function wineDetailsToDomain(resource: WineDetailsResource): WineDetails {
  return Object.fromEntries(Object.entries(wineDetailKeys).map(([key, apiKey]) => [key, resource[apiKey] ?? null]));
}

export function inventoryPayloadToResource(payload: CreateWineInventoryItemPayload): CreateWineInventoryItemResource;
export function inventoryPayloadToResource(payload: UpdateWineInventoryItemPayload): UpdateWineInventoryItemResource;
export function inventoryPayloadToResource(payload: UpdateWineInventoryItemPayload): UpdateWineInventoryItemResource {
  const keys = { name: 'name', quantity: 'quantity', ...wineDetailKeys } as const;
  // Undefined/omitted is not null. Never clear hidden fields during PATCH.
  return Object.fromEntries(Object.entries(keys).filter(([key]) => payload[key as keyof typeof payload] !== undefined)
    .map(([key, apiKey]) => [apiKey, payload[key as keyof typeof payload]]));
}
