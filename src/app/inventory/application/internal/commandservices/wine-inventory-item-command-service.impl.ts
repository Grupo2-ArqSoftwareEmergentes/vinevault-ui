import { HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  CreateWineInventoryItemPayload,
  WineInventoryImportResult,
  WineInventoryItemCommandService,
} from '../../../domain/services/wine-inventory-item-command-service';
import { WineInventoryItem } from '../../../domain/services/wine-inventory-item-query-service';
import { WineInventoryItemHttpCommandGateway } from '../../../infrastructure/api/gateways/wine-inventory-item-http-command.gateway';
import { WineInventoryImportResultResource } from '../../../interfaces/rest/resources/wine-inventory-import-result.resource';
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

  override getInventoryExport(wineCellarId: string): Observable<HttpResponse<Blob>> {
    return this.gateway.getInventoryExport(wineCellarId);
  }

  override getInventoryTemplate(wineCellarId: string): Observable<HttpResponse<Blob>> {
    return this.gateway.getInventoryTemplate(wineCellarId);
  }

  override importInventory(wineCellarId: string, file: File): Observable<WineInventoryImportResult> {
    return this.gateway.importInventory(wineCellarId, file).pipe(
      map((resource: WineInventoryImportResultResource) => ({
        sheetName: resource.sheet_name,
        totalRows: resource.total_rows,
        created: resource.created,
        updated: resource.updated,
      }))
    );
  }
}
