import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../../../api.config';
import { CreateWineCellarResource } from '../../../interfaces/rest/resources/create-wine-cellar.resource';
import { LinkDeviceToWineCellarResource } from '../../../interfaces/rest/resources/link-device-to-wine-cellar.resource';
import { UpdateWineCellarResource } from '../../../interfaces/rest/resources/update-wine-cellar.resource';
import { WineCellarCollectionResource, WineCellarResource } from '../../../interfaces/rest/resources/wine-cellar.resource';
import { WineCellarGateway } from './wine-cellar.gateway';

@Injectable({ providedIn: 'root' })
export class WineCellarHttpGateway implements WineCellarGateway {
  private readonly wineCellarsUrl = API_CONFIG.baseUrl + API_CONFIG.endpoints.wineCellars;

  constructor(private readonly http: HttpClient) {}

  getWineCellarsBySpace(spaceId: string): Observable<WineCellarCollectionResource> {
    return this.http.get<WineCellarCollectionResource>(`${API_CONFIG.baseUrl}/api/v1/spaces/${spaceId}/wine-cellars`);
  }

  createWineCellar(spaceId: string, resource: CreateWineCellarResource): Observable<WineCellarResource> {
    return this.http.post<WineCellarResource>(`${API_CONFIG.baseUrl}/api/v1/spaces/${spaceId}/wine-cellars`, resource);
  }

  updateWineCellar(wineCellarId: string, resource: UpdateWineCellarResource): Observable<WineCellarResource> {
    return this.http.put<WineCellarResource>(`${this.wineCellarsUrl}/${wineCellarId}`, resource);
  }

  deleteWineCellar(wineCellarId: string): Observable<void> {
    return this.http.delete<void>(`${this.wineCellarsUrl}/${wineCellarId}`);
  }

  linkDevice(wineCellarId: string, resource: LinkDeviceToWineCellarResource): Observable<WineCellarResource> {
    return this.http.post<WineCellarResource>(`${this.wineCellarsUrl}/${wineCellarId}/devices`, resource);
  }

  unlinkDevice(wineCellarId: string, deviceId: string): Observable<WineCellarResource> {
    return this.http.delete<WineCellarResource>(`${this.wineCellarsUrl}/${wineCellarId}/devices/${deviceId}`);
  }
}
