import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { StockMovementService } from '../../../application/internal/commandservices/stock-movement.service';
import { wineInventoryItemResourceToDomain } from './wine-inventory-item.transform';
import { inventoryPayloadToResource, wineDetailKeys } from './wine-details.transform';
import { WineInventoryItemResource } from '../resources/wine-inventory-item.resource';
import { API_CONFIG } from '../../../../api.config';

const base = `${API_CONFIG.baseUrl}/api/v1/wine-cellars/cellar-1/inventory`;
const resource: WineInventoryItemResource = {
  id: 'item-1', wine_cellar_id: 'cellar-1', name: 'Reserva', wine_name: 'Legacy', quantity: 0,
  winery: 'Estate', vintage: 'NV', physical_location: 'A1', country: 'Peru', region: 'Ica', appellation: 'Ica',
  wine_type: null, age_years: null, bottle_format: '750 ml', aging: 'Oak', alcohol_percentage: '0.00',
  consumption_window: '2026–2030', purchase_price: '19.99', sale_price: '29.99', min_stock_alert: 0,
  supplier_name: 'Supplier', origin_type: 'GIFT', purchase_date: '2026-11-16', batch_invoice_number: 'B01',
  rating: '100.00', body_slider: '0.00', acidity_slider: '4.50', tannins_slider: '5.00', aroma_tags: [],
  occasion_notes: 'Dinner', company_notes: null, would_buy_again: false, created_at: null, updated_at: null,
};

describe('Inventory REST contract', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('maps every optional detail without converting decimals or falsy values', () => {
    const item = wineInventoryItemResourceToDomain(resource);
    expect(item.name).toBe('Reserva');
    expect(item.quantity).toBe(0);
    expect(item.wineType).toBeNull();
    expect(item.vintage).toBe('NV');
    expect(item.purchasePrice).toBe('19.99');
    expect(item.rating).toBe('100.00');
    expect(item.minStockAlert).toBe(0);
    expect(item.wouldBuyAgain).toBe(false);
    expect(item.aromaTags).toEqual([]);
    for (const [domainKey, apiKey] of Object.entries(wineDetailKeys)) {
      expect(item[domainKey as keyof typeof item]).toEqual(resource[apiKey as keyof typeof resource]);
    }
    const mapped = inventoryPayloadToResource(item);
    expect(mapped).not.toHaveProperty('id');
    expect(mapped).not.toHaveProperty('wine_cellar_id');
    expect(mapped).not.toHaveProperty('wine_name');
    for (const apiKey of Object.values(wineDetailKeys)) expect(mapped[apiKey]).toEqual(resource[apiKey]);
  });

  it('reads the legacy name only as a fallback and never infers vintage from age', () => {
    const item = wineInventoryItemResourceToDomain({ ...resource, name: null, vintage: undefined, age_years: 7 });
    expect(item.name).toBe('Legacy');
    expect(item.vintage).toBeNull();
    expect(wineInventoryItemResourceToDomain({ ...resource, name: '' }).name).toBe('');
  });

  it('creates using only name and explicit quantity when all optional fields are omitted', () => {
    const next = vi.fn();
    TestBed.inject(WineInventoryItemCommandServiceImpl).createInventoryItem('cellar-1', { name: 'Reserva personal', quantity: 3, vintage: 'NV' }).subscribe(next);
    const request = http.expectOne(base);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Reserva personal', quantity: 3, vintage: 'NV' });
    request.flush(resource);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'Reserva', quantity: 0 }));
  });

  it('PATCH sends only modified keys, preserving explicit null, false, zero and empty arrays', () => {
    TestBed.inject(WineInventoryItemCommandServiceImpl).updateInventoryItem('cellar-1', 'item-1', {
      purchasePrice: '15.50', supplierName: null, minStockAlert: 0, wouldBuyAgain: false, aromaTags: [], vintage: undefined,
    }).subscribe();
    const request = http.expectOne(`${base}/item-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ purchase_price: '15.50', supplier_name: null, min_stock_alert: 0, would_buy_again: false, aroma_tags: [] });
    request.flush(resource);
    http.expectNone((request) => request.method === 'PUT');
  });

  it('registers one movement, maps stock_after and reads scoped history with limit=100', () => {
    const service = TestBed.inject(StockMovementService);
    const next = vi.fn();
    service.create('cellar-1', 'item-1', { quantity: 1, reason: 'uncorking', notes: 'Dinner' }).subscribe(next);
    const request = http.expectOne(`${base}/item-1/movements`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ quantity: 1, reason: 'uncorking', notes: 'Dinner' });
    const movement = { id: 'move-1', inventory_item_id: 'item-1', user_id: 7, quantity: 1, reason: 'uncorking', stock_before: 1, stock_after: 0, notes: 'Dinner', created_at: null };
    request.flush(movement);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ stockBefore: 1, stockAfter: 0 }));
    service.list('cellar-1', 'item-1').subscribe();
    const history = http.expectOne(`${base}/item-1/movements?limit=100`);
    expect(history.request.method).toBe('GET');
    history.flush([movement]);
    http.expectNone((request) => request.method === 'PUT' || request.method === 'PATCH');
  });

  it('does not retry a failed movement POST automatically', () => {
    const error = vi.fn();
    TestBed.inject(StockMovementService).create('cellar-1', 'item-1', { quantity: 2, reason: 'sale' }).subscribe({ error });
    http.expectOne(`${base}/item-1/movements`).flush({}, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledOnce();
    http.expectNone((request) => request.method === 'POST');
  });
});
