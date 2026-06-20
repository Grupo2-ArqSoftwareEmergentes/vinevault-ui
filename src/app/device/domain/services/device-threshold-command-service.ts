import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateDeviceThresholdCommand } from '../model/commands/create-device-threshold.command';
import { UpdateDeviceThresholdCommand } from '../model/commands/update-device-threshold.command';
import { DeleteDeviceThresholdCommand } from '../model/commands/delete-device-threshold.command';
import { DeviceId } from '../model/valueobjects/device-id.value-object';
import { MetricThreshold } from '../model/valueobjects/metric-threshold.value-object';
import { DeviceThreshold } from './device-threshold-query-service';

export type DeviceThresholdInput = Readonly<{
  metric: MetricThreshold;
  value: number;
  enabled: boolean;
}>;

export interface DeviceThresholdCommandService {
  handleCreateDeviceThreshold(command: CreateDeviceThresholdCommand): Observable<DeviceThreshold>;
  handleUpdateDeviceThreshold(command: UpdateDeviceThresholdCommand): Observable<DeviceThreshold>;
  handleDeleteDeviceThreshold(command: DeleteDeviceThresholdCommand): Observable<void>;
  handleSaveDeviceThresholds(deviceId: DeviceId, thresholds: readonly DeviceThresholdInput[]): Observable<void>;
}



export const DEVICE_THRESHOLD_COMMAND_SERVICE = new InjectionToken<DeviceThresholdCommandService>('DeviceThresholdCommandService');
