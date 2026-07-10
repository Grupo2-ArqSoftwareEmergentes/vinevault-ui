import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { CreateWineInventoryItemResource } from '../../../interfaces/rest/resources/create-wine-inventory-item.resource';
import { WineInventoryImportResultResource } from '../../../interfaces/rest/resources/wine-inventory-import-result.resource';
import { WineInventoryItemResource } from '../../../interfaces/rest/resources/wine-inventory-item.resource';

export interface WineInventoryItemCommandGateway {
  createInventoryItem(wineCellarId: string, resource: CreateWineInventoryItemResource): Observable<WineInventoryItemResource>;
  updateInventoryItem(
    wineCellarId: string,
    itemId: string,
    resource: CreateWineInventoryItemResource
  ): Observable<WineInventoryItemResource>;
  deleteInventoryItem(wineCellarId: string, itemId: string): Observable<void>;

  getInventoryExport(wineCellarId: string): Observable<HttpResponse<Blob>>;

  getInventoryTemplate(wineCellarId: string): Observable<HttpResponse<Blob>>;

  importInventory(wineCellarId: string, file: File): Observable<WineInventoryImportResultResource>;
}
