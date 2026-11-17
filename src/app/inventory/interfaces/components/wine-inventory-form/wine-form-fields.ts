import { WineDetails } from '../../../domain/model/wine-details';

export interface WineFormField {
  key: keyof WineDetails | 'name' | 'quantity';
  label: string;
  kind?: 'integer' | 'decimal' | 'date' | 'origin' | 'boolean' | 'tags' | 'slider' | 'notes';
  min?: number;
  max?: number;
  maxLength?: number;
  purpose?: 'COLLECTOR' | 'BUSINESS';
  group: string;
}

export const wineFormFields: readonly WineFormField[] = [
  { key: 'name', label: 'Nombre del vino', group: 'Identificación' },
  { key: 'winery', label: 'Winery', group: 'Identificación' },
  { key: 'vintage', label: 'Vintage (2020 / NV)', group: 'Identificación' },
  { key: 'quantity', label: 'Quantity', kind: 'integer', min: 0, group: 'Identificación' },
  { key: 'physicalLocation', label: 'Physical location', group: 'Identificación' },
  { key: 'country', label: 'Country', maxLength: 100, group: 'Ficha' },
  { key: 'region', label: 'Region', group: 'Ficha' },
  { key: 'appellation', label: 'Appellation', group: 'Ficha' },
  { key: 'wineType', label: 'Wine type', group: 'Ficha' },
  { key: 'bottleFormat', label: 'Bottle format', maxLength: 50, group: 'Ficha' },
  { key: 'aging', label: 'Aging', group: 'Ficha' },
  { key: 'alcoholPercentage', label: 'Alcohol (%)', kind: 'decimal', min: 0, max: 100, group: 'Ficha' },
  { key: 'consumptionWindow', label: 'Consumption window', group: 'Ficha' },
  { key: 'purchasePrice', label: 'Purchase price', kind: 'decimal', min: 0, max: 9999999999.99, group: 'Compra' },
  { key: 'originType', label: 'Origen', kind: 'origin', purpose: 'COLLECTOR', group: 'Compra' },
  { key: 'purchaseDate', label: 'Fecha de compra', kind: 'date', purpose: 'COLLECTOR', group: 'Compra' },
  { key: 'salePrice', label: 'Sale price', kind: 'decimal', min: 0, max: 9999999999.99, purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'minStockAlert', label: 'Minimum stock alert', kind: 'integer', min: 0, purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'supplierName', label: 'Supplier', purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'batchInvoiceNumber', label: 'Batch / invoice number', maxLength: 100, purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'rating', label: 'Rating (1–100 points)', kind: 'decimal', min: 1, max: 100, purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'bodySlider', label: 'Cuerpo (0–5)', kind: 'slider', min: 0, max: 5, group: 'Experiencia' },
  { key: 'aciditySlider', label: 'Acidez (0–5)', kind: 'slider', min: 0, max: 5, group: 'Experiencia' },
  { key: 'tanninsSlider', label: 'Taninos (0–5)', kind: 'slider', min: 0, max: 5, group: 'Experiencia' },
  { key: 'aromaTags', label: 'Aromas', kind: 'tags', group: 'Experiencia' },
  { key: 'occasionNotes', label: 'Notas previas', kind: 'notes', maxLength: 4000, group: 'Experiencia' },
  { key: 'companyNotes', label: 'Company notes', kind: 'notes', maxLength: 4000, purpose: 'COLLECTOR', group: 'Experiencia' },
  { key: 'wouldBuyAgain', label: 'Would buy again?', kind: 'boolean', purpose: 'COLLECTOR', group: 'Experiencia' },
];
