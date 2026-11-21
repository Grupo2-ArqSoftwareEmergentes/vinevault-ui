import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InventoryApiService } from './inventory-api.service';
import { API_CONFIG } from '../../../api.config';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';

describe('Inventory AI autocomplete API', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('POSTs only the requested wine name using the configured Core base URL', () => {
    TestBed.inject(WorkspaceScopeService).activate({ id: { value: 'space-1' }, name: 'Selected' });
    const response = { winery: 'Bodega', vintage: 'NV' };
    let received: unknown;
    TestBed.inject(InventoryApiService).autocompleteWine('Reserva').subscribe(value => { received = value; });
    const request = TestBed.inject(HttpTestingController).expectOne(API_CONFIG.baseUrl + API_CONFIG.endpoints.autocompleteWine + '?space_id=space-1');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ wine_name: 'Reserva' });
    request.flush(response);
    expect(received).toEqual(response);
  });

  it('uses the newly selected space on each call and never posts without a space', () => {
    const service = TestBed.inject(InventoryApiService);
    const http = TestBed.inject(HttpTestingController);
    let error: unknown;
    service.autocompleteWine('Reserva').subscribe({ error: value => { error = value; } });
    expect(error).toBeInstanceOf(Error);
    http.expectNone(() => true);
    for (const id of ['free-space', 'pro-space']) {
      TestBed.inject(WorkspaceScopeService).activate({ id: { value: id }, name: id });
      service.autocompleteWine('Reserva').subscribe();
      http.expectOne(API_CONFIG.baseUrl + API_CONFIG.endpoints.autocompleteWine + '?space_id=' + id).flush({});
    }
  });
});
