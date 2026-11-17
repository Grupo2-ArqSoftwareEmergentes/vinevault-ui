import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../../../api.config';
import { StockExitPayload, StockExitReason } from '../../../domain/model/stock-movement';

export interface StockMovementResource {
  id: string;
  inventory_item_id: string;
  user_id: number;
  reason: StockExitReason;
  quantity: number;
  stock_before: number;
  stock_after: number;
  notes: string | null;
  created_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class StockMovementHttpGateway {
  private readonly http = inject(HttpClient);
  private url(cellarId: string, itemId: string): string {
    return `${API_CONFIG.baseUrl}/api/v1/wine-cellars/${encodeURIComponent(cellarId)}/inventory/${encodeURIComponent(itemId)}/movements`;
  }
  list(cellarId: string, itemId: string) {
    return this.http.get<readonly StockMovementResource[]>(this.url(cellarId, itemId), { params: { limit: 100 } });
  }
  create(cellarId: string, itemId: string, payload: StockExitPayload) {
    // Explicit allowlist: author is taken from JWT. Never retry this non-idempotent POST.
    return this.http.post<StockMovementResource>(this.url(cellarId, itemId), {
      quantity: payload.quantity, reason: payload.reason, notes: payload.notes ?? null,
    });
  }
}
