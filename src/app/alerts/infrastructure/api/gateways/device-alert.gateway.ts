import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { DeviceAlertResource } from '../../../interfaces/rest/resources/device-alert.resource';

export interface DeviceAlertGateway {
  getDeviceAlerts(deviceId: string, activeOnly: boolean): Observable<DeviceAlertResource[]>;
}

export const DEVICE_ALERT_GATEWAY = new InjectionToken<DeviceAlertGateway>('DeviceAlertGateway');

