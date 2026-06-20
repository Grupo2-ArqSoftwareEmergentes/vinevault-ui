import { Observable } from 'rxjs';
import { InjectionToken } from '@angular/core';
import { DeviceThresholdResource } from '../../../interfaces/rest/resources/device-threshold.resource';
import { UpdateDeviceThresholdResource } from '../../../interfaces/rest/resources/update-device-threshold.resource';
import { SaveDeviceThresholdsResource } from '../../../interfaces/rest/resources/save-device-thresholds.resource';

export interface DeviceThresholdGateway {
  getThresholds(deviceId: string): Observable<DeviceThresholdResource[]>;
  createThreshold(deviceId: string, resource: UpdateDeviceThresholdResource): Observable<DeviceThresholdResource>;
  updateThreshold(
    deviceId: string,
    metric: string,
    resource: UpdateDeviceThresholdResource
  ): Observable<DeviceThresholdResource>;
  saveThresholds(deviceId: string, resource: SaveDeviceThresholdsResource): Observable<void>;
  deleteThreshold(deviceId: string, metric: string): Observable<void>;
}

export const DEVICE_THRESHOLD_GATEWAY = new InjectionToken<DeviceThresholdGateway>('DEVICE_THRESHOLD_GATEWAY');

