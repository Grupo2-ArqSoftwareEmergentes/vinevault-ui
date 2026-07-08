import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  CreateWineInventoryItemPayload,
  WineInventoryItemCommandService,
} from '../../../domain/services/wine-inventory-item-command-service';
import { WineInventoryItem } from '../../../domain/services/wine-inventory-item-query-service';
import { WineInventoryItemHttpCommandGateway } from '../../../infrastructure/api/gateways/wine-inventory-item-http-command.gateway';
import { wineInventoryItemResourceToDomain } from '../../../interfaces/rest/transform/wine-inventory-item.transform';

@Injectable({ providedIn: 'root' })
export class WineInventoryItemCommandServiceImpl extends WineInventoryItemCommandService {
  constructor(private readonly gateway: WineInventoryItemHttpCommandGateway) {
    super();
  }

  override createInventoryItem(wineCellarId: string, payload: CreateWineInventoryItemPayload): Observable<WineInventoryItem> {
    return this.gateway
      .createInventoryItem(wineCellarId, {
        wine_name: payload.wineName,
        wine_type: payload.wineType,
        age_years: payload.ageYears,
        quantity: payload.quantity,
      })
      .pipe(map(wineInventoryItemResourceToDomain));
  }
}
