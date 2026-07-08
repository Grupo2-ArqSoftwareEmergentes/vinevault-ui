import { Observable } from 'rxjs';

import { WineCellarId } from '../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { WineInventoryItem } from './wine-inventory-item-query-service';

export type CreateWineInventoryItemPayload = Readonly<{
  wineName: string;
  wineType: string;
  ageYears: number;
  quantity: number;
}>;

export abstract class WineInventoryItemCommandService {
  abstract createInventoryItem(
    wineCellarId: string,
    payload: CreateWineInventoryItemPayload
  ): Observable<WineInventoryItem>;
}
