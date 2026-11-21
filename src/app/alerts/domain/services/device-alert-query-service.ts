import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { GetDeviceAlertsByDeviceQuery } from '../model/queries/get-device-alerts-by-device.query';
import { DeviceId } from '../../../device/domain/model/valueobjects/device-id.value-object';
import { SpaceId } from '../../../device/domain/model/valueobjects/space-id.value-object';

export type DeviceAlert = Readonly<{
  id: string;
  deviceId: DeviceId;
  deviceName?: string | null;
  serialNumber?: string | null;
  cellarName?: string | null;
  cellarId?: string | null;
  assignmentId: string | null;
  spaceId: SpaceId | null;
  metric: string;
  thresholdMetric: string;
  thresholdValue: string;
  actualValue: string;
  message: string;
  status: string;
  occurredAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export interface DeviceAlertQueryService {
  handleGetAlertsBySpace(spaceId: SpaceId, activeOnly?: boolean): Observable<readonly DeviceAlert[]>;
  handleGetDeviceAlertsByDevice(query: GetDeviceAlertsByDeviceQuery): Observable<readonly DeviceAlert[]>;
}

export const DEVICE_ALERT_QUERY_SERVICE = new InjectionToken<DeviceAlertQueryService>('DeviceAlertQueryService');
