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

  getDeviceAlerts(deviceId: string, activeOnly: boolean): Observable<DeviceAlertResource[]> {
    const params = activeOnly ? new HttpParams().set('active_only', 'true') : undefined;
    return this.http.get<DeviceAlertResource[]>(`${this.deviceUrl}/${deviceId}/alerts`, params ? { params } : {});
  }
}
