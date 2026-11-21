import { Observable } from 'rxjs';

import { WineCellarId } from '../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { WineInventoryItemId } from '../model/valueobjects/wine-inventory-item-id.value-object';
import { WineDetails } from '../model/wine-details';

export type WineInventoryItem = Readonly<WineDetails & {
  id: WineInventoryItemId;
  wineCellarId: WineCellarId;
  name: string;
  quantity: number;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export abstract class WineInventoryItemQueryService {
  abstract getInventoryItemsByWineCellar(wineCellarId: string): Observable<readonly WineInventoryItem[]>;
}
