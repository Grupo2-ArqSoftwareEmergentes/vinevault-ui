import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../../../api.config';
import { WineInventoryItemCollectionResource } from '../../../interfaces/rest/resources/wine-inventory-item.resource';
import { WineInventoryItemGateway } from './wine-inventory-item.gateway';

@Injectable({ providedIn: 'root' })
export class WineInventoryItemHttpGateway implements WineInventoryItemGateway {
  constructor(private readonly http: HttpClient) {}

  getInventoryItemsByWineCellar(wineCellarId: string): Observable<WineInventoryItemCollectionResource> {
    return this.http.get<WineInventoryItemCollectionResource>(
      `${API_CONFIG.baseUrl}/api/v1/wine-cellars/${wineCellarId}/inventory`
    );
  }
}
