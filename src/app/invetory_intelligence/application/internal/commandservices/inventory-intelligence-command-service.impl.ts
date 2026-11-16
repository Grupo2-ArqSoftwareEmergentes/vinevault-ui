import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { InventoryIntelligenceCommandService } from '../../../domain/services/inventory-intelligence-command-service';
import { AnalysisResult } from '../../../domain/model/entities/analysis-result.model';
import { API_CONFIG } from '../../../../api.config';
import { AnalysisResultResource } from '../../../interfaces/rest/resources/analysis-result.resource';
import { analysisResultResourceToDomain } from '../../../interfaces/rest/transform/analysis-result.transform';
import { StorageService } from '../../../../core/services/storage/storage';
import { StockAnalysisError, StockAnalysisEvent } from '../../../domain/model/entities/stock-analysis-event.model';
import { StockAnalysisSseParser } from '../../../interfaces/rest/transform/stock-analysis-sse.parser';

@Injectable({
  providedIn: 'root',
})
export class InventoryIntelligenceCommandServiceImpl implements InventoryIntelligenceCommandService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);

  analyzeStock(wineCellarId: string): Observable<AnalysisResult> {
    const payload = { wine_cellar_id: wineCellarId };
    return this.http
      .post<AnalysisResultResource>(API_CONFIG.baseUrl + API_CONFIG.endpoints.analyzeStock, payload)
      .pipe(map(analysisResultResourceToDomain));
  }

  analyzeStockStream(wineCellarId: string): Observable<StockAnalysisEvent> {
    return new Observable((subscriber) => {
      const controller = new AbortController();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      const run = async () => {
        try {
          const token = this.storage.get<string>('access_token') ?? this.storage.get<string>('accessToken');
          if (!token) throw new StockAnalysisError('Your session has expired. Please sign in again.', 401);
          const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyzeStock}?stream=true`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
            body: JSON.stringify({ wine_cellar_id: wineCellarId }),
            signal: controller.signal,
          });
          if (subscriber.closed) return;
          if (!response.ok) {
            let body: Record<string, unknown> = {};
            try { body = await response.json(); } catch { /* Use the status-specific message below. */ }
            throw new StockAnalysisError(messageFrom(body, httpMessage(response.status)), response.status, retryAfter(response.headers.get('Retry-After')));
          }
          const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
          const finish = (resource: AnalysisResultResource) => {
            if (typeof resource?.content !== 'string' || (resource.wine_cellar_id && resource.wine_cellar_id !== wineCellarId)) {
              throw new StockAnalysisError('Invalid inventory analysis response.');
            }
            subscriber.next({ type: 'done', result: analysisResultResourceToDomain(resource) });
            subscriber.complete();
          };
          if (contentType === 'application/json') {
            const body = await response.json();
            if (body.status === 'empty') {
              subscriber.next({ type: 'empty', message: messageFrom(body, 'No hay vinos en esta cava para analizar.') });
              subscriber.complete();
            } else finish(body);
            return;
          }
          if (contentType !== 'text/event-stream' || !response.body) throw new StockAnalysisError('The analysis service did not return a readable stream.');
          reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          const parser = new StockAnalysisSseParser();
          while (!subscriber.closed) {
            const chunk = await reader.read();
            const messages = parser.push(decoder.decode(chunk.value, { stream: !chunk.done }), chunk.done);
            for (const message of messages) {
              if (!['delta', 'done', 'error'].includes(message.event)) continue;
              let data;
              try { data = JSON.parse(message.data); }
              catch { throw new StockAnalysisError('Invalid event received from the analysis service.'); }
              if (message.event === 'delta') {
                if (typeof data.text !== 'string') throw new StockAnalysisError('Invalid analysis fragment.');
                subscriber.next({ type: 'delta', text: data.text });
              } else if (message.event === 'done') {
                finish(data.result);
                return;
              } else {
                throw new StockAnalysisError(messageFrom(data, 'The analysis could not be completed.'), data.status_code, retryAfter(data.retry_after ?? response.headers.get('Retry-After')));
              }
            }
            if (chunk.done) throw new StockAnalysisError('The analysis connection was interrupted before completion.');
          }
        } catch (error) {
          if (!subscriber.closed) subscriber.error(error instanceof StockAnalysisError ? error : new StockAnalysisError('Unable to connect to the analysis service. The connection may have been interrupted.'));
        } finally {
          if (reader) {
            try { await reader.cancel(); } catch { /* Already aborted or disconnected. */ }
            reader.releaseLock();
          }
        }
      };
      void run();
      return () => {
        controller.abort();
        void reader?.cancel().catch(() => { /* Already closed. */ });
      };
    });
  }
}

function messageFrom(body: Record<string, unknown> | null, fallback: string): string {
  for (const value of [body?.['message'], body?.['detail'], body?.['content']]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function retryAfter(value: unknown): number | null {
  if (value == null || value === '') return null;
  const seconds = Number(value);
  const date = Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Date.parse(String(value));
  return Number.isFinite(date) ? Math.max(Date.now(), date) : null;
}

function httpMessage(status: number): string {
  switch (status) {
    case 401: return 'Your session has expired. Please sign in again.';
    case 403: return 'You do not have permission to analyze this cellar.';
    case 404: return 'This cellar no longer exists.';
    case 429: return 'Your analysis quota has been reached. Please try again later.';
    case 503: return 'The analysis service is temporarily unavailable.';
    case 504: return 'The analysis service timed out.';
    default: return 'Unable to complete inventory analysis at this time.';
  }
}
