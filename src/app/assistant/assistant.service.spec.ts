import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_CONFIG } from '../api.config';
import { AssistantMessage, AssistantService } from './assistant.service';

describe('Assistant HTTP contract', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  for (const mode of ['CHAT', 'SOMMELIER_ANALYSIS'] as const) {
    it(`posts ${mode} with context and at most ten bounded, alternating history messages`, () => {
      const history: AssistantMessage[] = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i} ${'a'.repeat(2100)}` }));
      TestBed.inject(AssistantService).chat({ spaceId: 'space-1', cellarId: 'cellar-1' }, mode, ' Consulta ', history).subscribe();
      const request = TestBed.inject(HttpTestingController).expectOne(API_CONFIG.baseUrl + API_CONFIG.endpoints.assistantChat);
      expect(request.request.method).toBe('POST');
      const body = request.request.body;
      expect(body).toEqual({ space_id: 'space-1', cellar_id: 'cellar-1', mode, message: 'Consulta', history: history.slice(-10).map(item => ({ ...item, content: item.content.slice(0, 2000) })) });
      expect(body.history.map((item: AssistantMessage) => item.role)).toEqual(Array.from({ length: 10 }, (_, i) => i % 2 ? 'assistant' : 'user'));
      request.flush({ reply: 'Respuesta', mode, context_summary: {} });
    });
  }
  it('omits cellar_id for a whole-space query', () => {
    TestBed.inject(AssistantService).chat({ spaceId: 'space-1' }, 'CHAT', 'Consulta', []).subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(API_CONFIG.baseUrl + API_CONFIG.endpoints.assistantChat);
    expect(request.request.body).toEqual({ space_id: 'space-1', mode: 'CHAT', message: 'Consulta', history: [] });
    request.flush({ reply: 'Respuesta', mode: 'CHAT', context_summary: {} });
  });
});
