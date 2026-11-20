import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom, tap, toArray } from 'rxjs';
import { vi } from 'vitest';
import { InventoryIntelligenceCommandServiceImpl } from './inventory-intelligence-command-service.impl';
import { StorageService } from '../../../../core/services/storage/storage';
import { API_CONFIG } from '../../../../api.config';
import { StockAnalysisError, StockAnalysisEvent } from '../../../domain/model/entities/stock-analysis-event.model';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';

const resource = { id: 'analysis-1', analysis_type: 'stock', wine_cellar_id: 'cellar-1', content: 'Definitivo', tokens_used: 12, created_at: '2026-11-16T00:00:00Z' };
const done = `event: done\ndata: ${JSON.stringify({ result: resource })}\n\n`;
const delta = (text: string) => `event: delta\ndata: ${JSON.stringify({ text })}\n\n`;

function response(text: string, byteByByte = false): Response {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      if (byteByByte) for (let index = 0; index < bytes.length; index++) controller.enqueue(bytes.slice(index, index + 1));
      else controller.enqueue(bytes);
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

describe('POST stock analysis streaming client', () => {
  let service: InventoryIntelligenceCommandServiceImpl;
  const fetchMock = vi.fn<typeof fetch>();
  const getToken = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    getToken.mockReset().mockImplementation((key: string) => key === 'access_token' ? 'jwt-token' : null);
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), { provide: StorageService, useValue: { get: getToken } },
      { provide: SessionAccessService, useValue: { handle: vi.fn() } },
    ] });
    service = TestBed.inject(InventoryIntelligenceCommandServiceImpl);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends an authenticated POST and decodes UTF-8 split across single-byte chunks', async () => {
    fetchMock.mockResolvedValue(response(delta('Añejó 🍷') + delta(' más') + done, true));
    const events = await firstValueFrom(service.analyzeStockStream('cellar-1').pipe(toArray()));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${API_CONFIG.baseUrl}/api/v1/ai/analyze-stock?stream=true`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ wine_cellar_id: 'cellar-1' }),
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-token', 'Content-Type': 'application/json' }),
      signal: expect.any(AbortSignal),
    }));
    expect(events[0]).toEqual({ type: 'delta', text: 'Añejó 🍷' });
    expect(events[1]).toEqual({ type: 'delta', text: ' más' });
    expect(events[2]).toEqual({ type: 'done', result: {
      id: 'analysis-1', analysisType: 'stock', wineCellarId: 'cellar-1', content: 'Definitivo', tokensUsed: 12, createdAt: resource.created_at,
    } });
  });

  it('publishes a delta while the connection is still open and aborts on unsubscribe', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; }, cancel }), { headers: { 'Content-Type': 'text/event-stream' } }));
    const next = vi.fn();
    const subscription = service.analyzeStockStream('cellar-1').subscribe(next);
    controller.enqueue(new TextEncoder().encode(delta('Visible now')));
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith({ type: 'delta', text: 'Visible now' }));
    subscription.unsubscribe();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('aborts the fetch stream when the active space changes', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; }, cancel }), { headers: { 'Content-Type': 'text/event-stream' } }));
    const next = vi.fn();
    const complete = vi.fn();
    const error = vi.fn();
    service.analyzeStockStream('cellar-1').subscribe({ next, complete, error });
    controller.enqueue(new TextEncoder().encode(delta('Partial')));
    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-2' }, name: 'Other space' });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  for (const field of ['message', 'content']) {
    it(`handles an empty-cellar JSON ${field} without streaming or retrying`, async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'empty', [field]: 'No hay vinos en esta cava para analizar.', tokens_used: 0 }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
      expect(await firstValueFrom(service.analyzeStockStream('cellar-1').pipe(toArray()))).toEqual([
        { type: 'empty', message: 'No hay vinos en esta cava para analizar.' },
      ]);
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  }

  it('also accepts a complete JSON result', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(resource), { headers: { 'Content-Type': 'application/json' } }));
    expect(await firstValueFrom(service.analyzeStockStream('cellar-1'))).toMatchObject({ type: 'done', result: { content: 'Definitivo' } });
  });

  it('treats an SSE error under HTTP 200 as failure after publishing partial text', async () => {
    fetchMock.mockResolvedValue(response(delta('Parcial') + 'event: error\ndata: {"message":"Quota exhausted","status_code":429,"retry_after":30}\n\n'));
    const events: StockAnalysisEvent[] = [];
    await expect(firstValueFrom(service.analyzeStockStream('cellar-1').pipe(tap((event) => events.push(event)), toArray())))
      .rejects.toMatchObject({ message: 'Quota exhausted', status: 429, retryAfterAt: expect.any(Number) });
    expect(events).toEqual([{ type: 'delta', text: 'Parcial' }]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects EOF without a terminal event and never reconnects automatically', async () => {
    fetchMock.mockResolvedValue(response(delta('Parcial')));
    await expect(firstValueFrom(service.analyzeStockStream('cellar-1').pipe(toArray())))
      .rejects.toThrow('interrupted before completion');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not accept an unterminated done event', async () => {
    fetchMock.mockResolvedValue(response(done.slice(0, -1)));
    await expect(firstValueFrom(service.analyzeStockStream('cellar-1').pipe(toArray())))
      .rejects.toThrow('interrupted before completion');
  });

  for (const [status, message] of [[401, 'session'], [403, 'permission'], [404, 'no longer exists'], [429, 'quota'], [503, 'unavailable'], [504, 'timed out']] as const) {
    it(`reports HTTP ${status} without retrying`, async () => {
      fetchMock.mockResolvedValue(new Response('{}', { status, headers: { 'Content-Type': 'application/json' } }));
      await expect(firstValueFrom(service.analyzeStockStream('cellar-1'))).rejects.toMatchObject({ status, message: expect.stringContaining(message) });
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  }

  for (const header of ['60', new Date(Date.now() + 60_000).toUTCString()]) {
    it(`preserves the quota message and Retry-After ${header}`, async () => {
      fetchMock.mockResolvedValue(new Response('{"detail":"Cuota diaria agotada"}', { status: 429, headers: { 'Retry-After': header } }));
      const error = await firstValueFrom(service.analyzeStockStream('cellar-1')).catch((value: StockAnalysisError) => value);
      expect(error).toBeInstanceOf(StockAnalysisError);
      expect(error).toMatchObject({ message: 'Cuota diaria agotada', retryAfterAt: expect.any(Number) });
      expect((error as StockAnalysisError).retryAfterAt!).toBeGreaterThan(Date.now());
    });
  }

  it('aborts even when cancellation happens before fetch resolves', async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const error = vi.fn();
    const subscription = service.analyzeStockStream('cellar-1').subscribe({ error });
    subscription.unsubscribe();
    await Promise.resolve();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it('fails locally without a JWT and supports the legacy token key', async () => {
    getToken.mockReturnValue(null);
    await expect(firstValueFrom(service.analyzeStockStream('cellar-1'))).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
    getToken.mockImplementation((key: string) => key === 'accessToken' ? 'legacy-jwt' : null);
    fetchMock.mockResolvedValue(response(done));
    await firstValueFrom(service.analyzeStockStream('cellar-1'));
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer legacy-jwt' });
  });

  it('rejects malformed events and results for another cellar', async () => {
    fetchMock.mockResolvedValueOnce(response('event: delta\ndata: broken\n\n'));
    await expect(firstValueFrom(service.analyzeStockStream('cellar-1'))).rejects.toThrow('Invalid event');
    fetchMock.mockResolvedValueOnce(response(`event: done\ndata: ${JSON.stringify({ result: { ...resource, wine_cellar_id: 'cellar-2' } })}\n\n`));
    await expect(firstValueFrom(service.analyzeStockStream('cellar-1'))).rejects.toThrow('Invalid inventory analysis');
  });

  it('does not revoke workspace session on 403 PLAN_FEATURE_UNAVAILABLE and surfaces backend message', async () => {
    const sessionAccess = TestBed.inject(SessionAccessService);
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({ detail: { code: 'PLAN_FEATURE_UNAVAILABLE', message: 'La función de IA no está incluida en el plan actual.' } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    ));
    await expect(firstValueFrom(service.analyzeStockStream('cellar-1'))).rejects.toMatchObject({
      status: 403,
      message: 'La función de IA no está incluida en el plan actual.',
    });
    expect(sessionAccess.handle).not.toHaveBeenCalled();
  });
});
