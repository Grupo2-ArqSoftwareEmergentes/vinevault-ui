import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../../../api.config';
import { DeviceAlertGateway } from './device-alert.gateway';
import { DeviceAlertResource } from '../../../interfaces/rest/resources/device-alert.resource';

@Injectable({ providedIn: 'root' })
export class DeviceAlertHttpGateway implements DeviceAlertGateway {
  private readonly deviceUrl = API_CONFIG.baseUrl + API_CONFIG.endpoints.devices;

  constructor(private readonly http: HttpClient) {}

  getSpaceAlerts(spaceId: string, activeOnly = false): Observable<DeviceAlertResource[]> {
    const params = new HttpParams().set('space_id', spaceId).set('active_only', activeOnly);
    return this.http.get<DeviceAlertResource[]>(`${API_CONFIG.baseUrl}/api/v1/alerts`, { params });
  }

  getDeviceAlerts(deviceId: string, activeOnly: boolean): Observable<DeviceAlertResource[]> {
    const params = activeOnly ? new HttpParams().set('active_only', 'true') : undefined;
    return this.http.get<DeviceAlertResource[]>(`${this.deviceUrl}/${deviceId}/alerts`, params ? { params } : {});
  }
}
