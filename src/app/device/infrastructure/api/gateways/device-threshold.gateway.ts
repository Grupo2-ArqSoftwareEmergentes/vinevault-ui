import { Observable } from 'rxjs';
import { InjectionToken } from '@angular/core';
import { DeviceThresholdResource } from '../../../interfaces/rest/resources/device-threshold.resource';
import { UpdateDeviceThresholdResource } from '../../../interfaces/rest/resources/update-device-threshold.resource';

export interface DeviceThresholdGateway {
  getThresholds(deviceId: string): Observable<DeviceThresholdResource[]>;
  createThreshold(deviceId: string, resource: UpdateDeviceThresholdResource): Observable<DeviceThresholdResource>;
  updateThreshold(deviceId: string, resource: UpdateDeviceThresholdResource): Observable<DeviceThresholdResource>;
  deleteThreshold(deviceId: string, metric: string): Observable<void>;
}

export const DEVICE_THRESHOLD_GATEWAY = new InjectionToken<DeviceThresholdGateway>('DEVICE_THRESHOLD_GATEWAY');

