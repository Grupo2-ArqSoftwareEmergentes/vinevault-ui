import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  WineInventoryItem,
  WineInventoryItemQueryService,
} from '../../../domain/services/wine-inventory-item-query-service';
import { WineInventoryItemHttpGateway } from '../../../infrastructure/api/gateways/wine-inventory-item-http.gateway';
import { wineInventoryItemsResourceToDomain } from '../../../interfaces/rest/transform/wine-inventory-item.transform';

@Injectable({ providedIn: 'root' })
export class WineInventoryItemQueryServiceImpl extends WineInventoryItemQueryService {
  constructor(private readonly gateway: WineInventoryItemHttpGateway) {
    super();
  }

  override getInventoryItemsByWineCellar(wineCellarId: string): Observable<readonly WineInventoryItem[]> {
    return this.gateway.getInventoryItemsByWineCellar(wineCellarId).pipe(map(wineInventoryItemsResourceToDomain));
  }
}
