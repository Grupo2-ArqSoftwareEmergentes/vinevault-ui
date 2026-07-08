import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../../../api.config';
import { CreateWineInventoryItemResource } from '../../../interfaces/rest/resources/create-wine-inventory-item.resource';
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
}
