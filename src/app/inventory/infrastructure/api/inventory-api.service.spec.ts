import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InventoryApiService } from './inventory-api.service';
import { API_CONFIG } from '../../../api.config';

describe('Inventory AI autocomplete API', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('POSTs only the requested wine name using the configured Core base URL', () => {
    const response = { winery: 'Bodega', vintage: 'NV' };
    let received: unknown;
    TestBed.inject(InventoryApiService).autocompleteWine('Reserva').subscribe(value => { received = value; });
    const request = TestBed.inject(HttpTestingController).expectOne(API_CONFIG.baseUrl + API_CONFIG.endpoints.autocompleteWine);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ wine_name: 'Reserva' });
    request.flush(response);
    expect(received).toEqual(response);
  });
});
