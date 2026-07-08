import { Observable } from 'rxjs';

import { WineInventoryItemCollectionResource } from '../../../interfaces/rest/resources/wine-inventory-item.resource';

export interface WineInventoryItemGateway {
  getInventoryItemsByWineCellar(wineCellarId: string): Observable<WineInventoryItemCollectionResource>;
}
