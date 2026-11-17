import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { StockExitPayload, StockMovement } from '../../../domain/model/stock-movement';
import { StockMovementHttpGateway, StockMovementResource } from '../../../infrastructure/api/gateways/stock-movement-http.gateway';

const toDomain = (resource: StockMovementResource): StockMovement => ({
  id: resource.id, inventoryItemId: resource.inventory_item_id, userId: resource.user_id,
  quantity: resource.quantity, reason: resource.reason, notes: resource.notes,
  stockBefore: resource.stock_before, stockAfter: resource.stock_after, createdAt: resource.created_at,
});

@Injectable({ providedIn: 'root' })
export class StockMovementService {
  private readonly gateway = inject(StockMovementHttpGateway);
  list(cellarId: string, itemId: string) { return this.gateway.list(cellarId, itemId).pipe(map((items) => items.map(toDomain))); }
  create(cellarId: string, itemId: string, payload: StockExitPayload) {
    return this.gateway.create(cellarId, itemId, payload).pipe(map(toDomain));
  }
}

export function stockMovementError(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : null;
  switch (status) {
    case 409: return 'Stock insuficiente. No se descontó ninguna botella. Actualiza el inventario antes de continuar.';
    case 403: return 'No tienes permisos para realizar esta operación.';
    case 404: return 'El ítem ya no existe o no pertenece a esta cava.';
    case 422: return 'Datos inválidos. Revisa cantidad, motivo y notas.';
    default: return 'No se pudo confirmar la operación. Consulta el historial y actualiza el inventario antes de repetirla para evitar una salida duplicada.';
  }
}
