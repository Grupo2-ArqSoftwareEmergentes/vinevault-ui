import { Observable } from 'rxjs';

import { CreateWineInventoryItemResource } from '../../../interfaces/rest/resources/create-wine-inventory-item.resource';
import { WineInventoryItemResource } from '../../../interfaces/rest/resources/wine-inventory-item.resource';

export interface WineInventoryItemCommandGateway {
  createInventoryItem(wineCellarId: string, resource: CreateWineInventoryItemResource): Observable<WineInventoryItemResource>;
}
