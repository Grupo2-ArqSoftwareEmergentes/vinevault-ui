import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { CreateWineInventoryItemResource, UpdateWineInventoryItemResource } from '../../../interfaces/rest/resources/create-wine-inventory-item.resource';
import { WineInventoryImportResultResource } from '../../../interfaces/rest/resources/wine-inventory-import-result.resource';
import { WineInventoryItemResource } from '../../../interfaces/rest/resources/wine-inventory-item.resource';
import { InventoryExportFormat } from '../../../domain/services/wine-inventory-item-command-service';

export interface WineInventoryItemCommandGateway {
  createInventoryItem(wineCellarId: string, resource: CreateWineInventoryItemResource): Observable<WineInventoryItemResource>;
  updateInventoryItem(
    wineCellarId: string,
    itemId: string,
    resource: UpdateWineInventoryItemResource
  ): Observable<WineInventoryItemResource>;
  deleteInventoryItem(wineCellarId: string, itemId: string): Observable<void>;

  exportInventory(spaceId: string, format: InventoryExportFormat, cellarId?: string): Observable<HttpResponse<Blob>>;

  getInventoryTemplate(wineCellarId: string): Observable<HttpResponse<Blob>>;

  importInventory(wineCellarId: string, file: File): Observable<WineInventoryImportResultResource>;
}
