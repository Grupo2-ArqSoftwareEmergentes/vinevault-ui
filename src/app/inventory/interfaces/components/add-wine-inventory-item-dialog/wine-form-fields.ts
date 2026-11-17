import { WineDetails } from '../../../domain/model/wine-details';

export interface WineFormField {
  key: keyof WineDetails;
  label: string;
  kind?: 'integer' | 'decimal' | 'date' | 'origin' | 'boolean' | 'tags';
  min?: number;
  max?: number;
  maxLength?: number;
  purpose?: 'COLLECTOR' | 'BUSINESS';
  group: string;
}

export const wineFormFields: readonly WineFormField[] = [
  { key: 'winery', label: 'Winery', group: 'Identificación' },
  { key: 'vintage', label: 'Vintage (2020 / NV)', group: 'Identificación' },
  { key: 'physicalLocation', label: 'Physical location', group: 'Identificación' },
  { key: 'country', label: 'Country', maxLength: 100, group: 'Ficha' },
  { key: 'region', label: 'Region', group: 'Ficha' },
  { key: 'appellation', label: 'Appellation', group: 'Ficha' },
  { key: 'wineType', label: 'Wine type', group: 'Ficha' },
  { key: 'bottleFormat', label: 'Bottle format', maxLength: 50, group: 'Ficha' },
  { key: 'aging', label: 'Aging', group: 'Ficha' },
  { key: 'alcoholPercentage', label: 'Alcohol (%)', kind: 'decimal', min: 0, max: 100, group: 'Ficha' },
  { key: 'consumptionWindow', label: 'Consumption window', group: 'Ficha' },
  { key: 'ageYears', label: 'Age years (optional, legacy)', kind: 'integer', min: 0, group: 'Ficha' },
  { key: 'purchasePrice', label: 'Purchase price', kind: 'decimal', min: 0, max: 9999999999.99, group: 'Compra' },
  { key: 'originType', label: 'Origin', kind: 'origin', group: 'Compra' },
  { key: 'purchaseDate', label: 'Purchase date', kind: 'date', group: 'Compra' },
  { key: 'salePrice', label: 'Sale price', kind: 'decimal', min: 0, max: 9999999999.99, purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'minStockAlert', label: 'Minimum stock alert', kind: 'integer', min: 0, purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'supplierName', label: 'Supplier', purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'batchInvoiceNumber', label: 'Batch / invoice number', maxLength: 100, purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'rating', label: 'Rating (1–100 points)', kind: 'decimal', min: 1, max: 100, purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'bodySlider', label: 'Body (0–5)', kind: 'decimal', min: 0, max: 5, purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'aciditySlider', label: 'Acidity (0–5)', kind: 'decimal', min: 0, max: 5, purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'tanninsSlider', label: 'Tannins (0–5)', kind: 'decimal', min: 0, max: 5, purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'aromaTags', label: 'Aroma tags', kind: 'tags', purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'occasionNotes', label: 'Occasion notes', maxLength: 4000, purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'companyNotes', label: 'Company notes', maxLength: 4000, purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'wouldBuyAgain', label: 'Would buy again?', kind: 'boolean', purpose: 'COLLECTOR', group: 'Experiencia' },
];
