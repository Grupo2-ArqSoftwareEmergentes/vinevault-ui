import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { DeviceId } from '../model/valueobjects/device-id.value-object';
import { MetricThreshold } from '../model/valueobjects/metric-threshold.value-object';
import { GetDeviceThresholdsByDeviceQuery } from '../model/queries/get-device-thresholds-by-device.query';

export type DeviceThreshold = Readonly<{
  id: string;
  deviceId: DeviceId;
  metric: MetricThreshold;
  metricLabel: string;
  metricUnit: string;
  value: number;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export interface DeviceThresholdQueryService {
  handleGetDeviceThresholdsByDevice(query: GetDeviceThresholdsByDeviceQuery): Observable<DeviceThreshold[]>;
}


export const DEVICE_THRESHOLD_QUERY_SERVICE = new InjectionToken<DeviceThresholdQueryService>('DeviceThresholdQueryService');
