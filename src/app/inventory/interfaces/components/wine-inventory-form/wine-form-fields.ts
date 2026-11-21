import { WineDetails } from '../../../domain/model/wine-details';

export interface WineFormField {
  key: keyof WineDetails | 'name' | 'quantity';
  label: string;
  kind?: 'integer' | 'decimal' | 'date' | 'origin' | 'boolean' | 'tags' | 'slider' | 'notes' | 'window';
  min?: number;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  hidden?: boolean;
  purpose?: 'COLLECTOR' | 'BUSINESS';
  group: string;
}

export const wineFormFields: readonly WineFormField[] = [
  { key: 'name', label: 'Nombre del vino', group: 'Identificación' },
  { key: 'quantity', label: 'Cantidad', kind: 'integer', min: 0, group: 'Identificación' },
  { key: 'winery', label: 'Bodega', group: 'Identificación' },
  { key: 'vintage', label: 'Añada', placeholder: '2020 o NV (sin añada)', group: 'Identificación' },
  { key: 'physicalLocation', label: 'Ubicación física', placeholder: 'Estante, fila o almacén', group: 'Identificación' },
  { key: 'country', label: 'País', maxLength: 100, group: 'Ficha' },
  { key: 'region', label: 'Región', group: 'Ficha' },
  { key: 'appellation', label: 'D.O. / Apelación', group: 'Ficha' },
  { key: 'wineType', label: 'Tipo de vino / Cepa', group: 'Ficha' },
  { key: 'bottleFormat', label: 'Formato', placeholder: '750 ml', maxLength: 50, group: 'Ficha' },
  { key: 'aging', label: 'Crianza', group: 'Ficha' },
  { key: 'alcoholPercentage', label: 'Alcohol (%)', kind: 'decimal', min: 0, max: 100, group: 'Ficha' },
  { key: 'consumptionWindow', label: 'Ventana de consumo óptima', kind: 'window', group: 'Ficha' },
  { key: 'purchasePrice', label: 'Precio pagado', kind: 'decimal', min: 0, max: 9999999999.99, group: 'Compra' },
  { key: 'originType', label: 'Origen', kind: 'origin', purpose: 'COLLECTOR', group: 'Compra' },
  { key: 'purchaseDate', label: 'Fecha de compra', kind: 'date', purpose: 'COLLECTOR', group: 'Compra' },
  { key: 'salePrice', label: 'Precio de venta', kind: 'decimal', min: 0, max: 9999999999.99, purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'minStockAlert', label: 'Alerta de stock mínimo', kind: 'integer', min: 0, purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'supplierName', label: 'Proveedor', purpose: 'BUSINESS', group: 'Negocio' },
  { key: 'batchInvoiceNumber', label: 'Lote / Factura', maxLength: 100, purpose: 'BUSINESS', group: 'Negocio' },
  // Retain legacy values in the model, but never validate or submit them from this editor.
  { key: 'rating', label: 'Puntuación (1–100 puntos)', kind: 'decimal', hidden: true, min: 1, max: 100, group: 'Experiencia' },
  { key: 'bodySlider', label: 'Cuerpo (0–5)', kind: 'slider', hidden: true, min: 0, max: 5, group: 'Experiencia' },
  { key: 'aciditySlider', label: 'Acidez (0–5)', kind: 'slider', hidden: true, min: 0, max: 5, group: 'Experiencia' },
  { key: 'tanninsSlider', label: 'Taninos (0–5)', kind: 'slider', hidden: true, min: 0, max: 5, group: 'Experiencia' },
  { key: 'aromaTags', label: 'Aromas', kind: 'tags', hidden: true, group: 'Experiencia' },
  { key: 'tastingNotes', label: 'Notas de cata', kind: 'notes', maxLength: 4000, group: 'Experiencia' },
  { key: 'occasionNotes', label: 'Notas previas', kind: 'notes', maxLength: 4000, group: 'Experiencia' },
  { key: 'companyNotes', label: 'Notas internas', kind: 'notes', maxLength: 4000, group: 'Experiencia' },
  { key: 'wouldBuyAgain', label: '¿Volvería a comprar?', kind: 'boolean', group: 'Experiencia' },
];
