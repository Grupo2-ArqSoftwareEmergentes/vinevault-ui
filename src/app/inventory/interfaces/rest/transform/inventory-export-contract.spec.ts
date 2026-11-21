import { TestBed } from '@angular/core/testing';
import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { API_CONFIG, apiUrl } from '../../../../api.config';
import { authInterceptor } from '../../../../core/interceptors/auth/auth-interceptor';
import { StorageService } from '../../../../core/services/storage/storage';

describe('Inventory report export and legacy workbook contracts', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    TestBed.inject(StorageService).set('access_token', 'export-test-token');
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.inject(StorageService).remove('access_token'); });

  for (const format of ['xlsx', 'pdf'] as const) {
    for (const cellarId of ['cellar-1', undefined]) {
      it(`exports ${format} for ${cellarId ?? 'the whole space'} using query parameters and the existing Bearer interceptor`, () => {
        let received: HttpResponse<Blob> | undefined;
        TestBed.inject(WineInventoryItemCommandServiceImpl).exportInventory('space-1', format, cellarId).subscribe(value => { received = value; });
        const request = TestBed.inject(HttpTestingController).expectOne(req => req.url === apiUrl(API_CONFIG.endpoints.exportInventory));
        expect(request.request.method).toBe('GET');
        expect(request.request.params.get('space_id')).toBe('space-1');
        expect(request.request.params.get('format')).toBe(format);
        expect(request.request.params.get('cellar_id')).toBe(cellarId ?? null);
        expect(request.request.params.keys()).toHaveLength(cellarId ? 3 : 2);
        expect(request.request.responseType).toBe('blob');
        expect(request.request.headers.get('Authorization')).toBe('Bearer export-test-token');
        const blob = new Blob(['report'], { type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        request.flush(blob, { headers: { 'Content-Disposition': `attachment; filename="informe.${format}"` } });
        expect(received?.body).toBe(blob);
        expect(received?.headers.get('Content-Disposition')).toContain(`informe.${format}`);
      });
    }
  }

  it('does not repeat /api/v1 when the deployment base URL already contains it', () => {
    const path = API_CONFIG.endpoints.exportInventory;
    for (const base of ['https://example.test', 'https://example.test/', 'https://example.test/api/v1', 'https://example.test/api/v1/']) {
      expect(apiUrl(path, base)).toBe('https://example.test/api/v1/inventory/export');
    }
  });

  it('retains the current cellar template URL and multipart import URL without a manual Content-Type', () => {
    const commands = TestBed.inject(WineInventoryItemCommandServiceImpl);
    const http = TestBed.inject(HttpTestingController);
    const root = API_CONFIG.baseUrl + '/api/v1/wine-cellars/cellar-1/inventory';
    commands.getInventoryTemplate('cellar-1').subscribe();
    const template = http.expectOne(root + '/template');
    expect(template.request.method).toBe('GET');
    expect(template.request.responseType).toBe('blob');
    template.flush(new Blob(['template']));
    const file = new File(['workbook'], 'inventory.xlsx');
    commands.importInventory('cellar-1', file).subscribe();
    const upload = http.expectOne(root + '/import');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBeInstanceOf(FormData);
    expect((upload.request.body.get('file') as File).name).toBe('inventory.xlsx');
    expect(upload.request.headers.has('Content-Type')).toBe(false);
    upload.flush({ sheet_name: 'inventory', total_rows: 1, created: 1, updated: 0 });
    http.expectNone(root + '/export');
  });
});
