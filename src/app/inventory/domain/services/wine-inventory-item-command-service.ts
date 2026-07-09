import { Observable } from 'rxjs';
import { HttpResponse } from '@angular/common/http';

import { WineCellarId } from '../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { WineInventoryItem } from './wine-inventory-item-query-service';

export type CreateWineInventoryItemPayload = Readonly<{
  wineName: string;
  wineType: string;
  ageYears: number;
  quantity: number;
}>;

export type WineInventoryImportResult = Readonly<{
  sheetName: string;
  totalRows: number;
  created: number;
  updated: number;
}>;

export abstract class WineInventoryItemCommandService {
  abstract createInventoryItem(
    wineCellarId: string,
    payload: CreateWineInventoryItemPayload
  ): Observable<WineInventoryItem>;

  abstract getInventoryExport(
    wineCellarId: string
  ): Observable<HttpResponse<Blob>>;

  abstract getInventoryTemplate(
    wineCellarId: string
  ): Observable<HttpResponse<Blob>>;

  abstract importInventory(
    wineCellarId: string,
    file: File
  ): Observable<WineInventoryImportResult>;
}
