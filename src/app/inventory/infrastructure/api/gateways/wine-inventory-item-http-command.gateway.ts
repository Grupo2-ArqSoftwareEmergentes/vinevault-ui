import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../../../api.config';
import { CreateWineInventoryItemResource } from '../../../interfaces/rest/resources/create-wine-inventory-item.resource';
import { WineInventoryImportResultResource } from '../../../interfaces/rest/resources/wine-inventory-import-result.resource';
import { WineInventoryItemResource } from '../../../interfaces/rest/resources/wine-inventory-item.resource';
import { WineInventoryItemCommandGateway } from './wine-inventory-item-command.gateway';

@Injectable({ providedIn: 'root' })
export class WineInventoryItemHttpCommandGateway implements WineInventoryItemCommandGateway {
  constructor(private readonly http: HttpClient) {}

  createInventoryItem(
    wineCellarId: string,
    resource: CreateWineInventoryItemResource
  ): Observable<WineInventoryItemResource> {
    return this.http.post<WineInventoryItemResource>(`${API_CONFIG.baseUrl}/api/v1/wine-cellars/${wineCellarId}/inventory`, resource);
  }

  getInventoryExport(wineCellarId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${API_CONFIG.baseUrl}/api/v1/wine-cellars/${wineCellarId}/inventory/export`, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  getInventoryTemplate(wineCellarId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${API_CONFIG.baseUrl}/api/v1/wine-cellars/${wineCellarId}/inventory/template`, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  importInventory(wineCellarId: string, file: File): Observable<WineInventoryImportResultResource> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<WineInventoryImportResultResource>(
      `${API_CONFIG.baseUrl}/api/v1/wine-cellars/${wineCellarId}/inventory/import`,
      formData
    );
  }
}
