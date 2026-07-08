import { Observable } from 'rxjs';

import { WineCellarId } from '../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { WineInventoryItemId } from '../model/valueobjects/wine-inventory-item-id.value-object';

export type WineInventoryItem = Readonly<{
  id: WineInventoryItemId;
  wineCellarId: WineCellarId;
  wineName: string;
  wineType: string;
  ageYears: number;
  quantity: number;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export abstract class WineInventoryItemQueryService {
  abstract getInventoryItemsByWineCellar(wineCellarId: string): Observable<readonly WineInventoryItem[]>;
}
