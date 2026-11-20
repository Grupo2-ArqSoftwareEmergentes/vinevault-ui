import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { I18nService } from '../../i18n/i18n.service';
import { languageInterceptor } from './language-interceptor';
import { API_CONFIG } from '../../../api.config';
import { PREFERRED_LANGUAGE_STORAGE_KEY } from '../../../iam/domain/models/profile';

describe('Request language preference', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([languageInterceptor])),
        provideHttpClientTesting(),
      ],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    document.documentElement.lang = 'es';
  });
  it('reads the active language for each Core request without changing payloads or third-party headers', () => {
    const http = TestBed.inject(HttpClient),
      controller = TestBed.inject(HttpTestingController),
      i18n = TestBed.inject(I18nService);
    for (const language of ['es', 'en'] as const) {
      i18n.setLanguage(language);
      http
        .post(API_CONFIG.baseUrl + '/api/v1/inventory/ai-autocomplete?space_id=selected', {
          wine_name: 'Reserva',
        })
        .subscribe();
      const req = controller.expectOne(
        API_CONFIG.baseUrl + '/api/v1/inventory/ai-autocomplete?space_id=selected',
      );
      expect(req.request.headers.get('Accept-Language')).toBe(language);
      expect(req.request.body).toEqual({ wine_name: 'Reserva' });
      req.flush({});
    }
    http.get('https://example.invalid/asset').subscribe();
    const thirdParty = controller.expectOne('https://example.invalid/asset');
    expect(thirdParty.request.headers.has('Accept-Language')).toBe(false);
    thirdParty.flush({});
  });
});
