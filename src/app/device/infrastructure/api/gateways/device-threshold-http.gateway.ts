import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../../../api.config';
import { DeviceThresholdGateway } from './device-threshold.gateway';
import { DeviceThresholdResource } from '../../../interfaces/rest/resources/device-threshold.resource';
import { UpdateDeviceThresholdResource } from '../../../interfaces/rest/resources/update-device-threshold.resource';

@Injectable({ providedIn: 'root' })
export class DeviceThresholdHttpGateway implements DeviceThresholdGateway {
  private readonly deviceUrl = API_CONFIG.baseUrl + API_CONFIG.endpoints.devices;

  constructor(private readonly http: HttpClient) {}

  getThresholds(deviceId: string): Observable<DeviceThresholdResource[]> {
    return this.http.get<DeviceThresholdResource[]>(`${this.deviceUrl}/${deviceId}/thresholds`);
  }

  createThreshold(deviceId: string, resource: UpdateDeviceThresholdResource): Observable<DeviceThresholdResource> {
    return this.http.post<DeviceThresholdResource>(`${this.deviceUrl}/${deviceId}/thresholds`, resource);
  }

  updateThreshold(deviceId: string, resource: UpdateDeviceThresholdResource): Observable<DeviceThresholdResource> {
    return this.http.put<DeviceThresholdResource>(`${this.deviceUrl}/${deviceId}/thresholds`, resource);
  }

  deleteThreshold(deviceId: string, metric: string): Observable<void> {
    return this.http.delete<void>(`${this.deviceUrl}/${deviceId}/thresholds/${metric}`);
  }
}

