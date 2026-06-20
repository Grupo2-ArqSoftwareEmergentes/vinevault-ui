import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DeviceThresholdQueryService, DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import { GetDeviceThresholdsByDeviceQuery } from '../../../domain/model/queries/get-device-thresholds-by-device.query';
import { DeviceThresholdHttpGateway } from '../../../infrastructure/api/gateways/device-threshold-http.gateway';
import { deviceThresholdResourceToDomain } from '../../../interfaces/rest/transform/device-threshold.transform';

@Injectable({ providedIn: 'root' })
export class DeviceThresholdQueryServiceImpl implements DeviceThresholdQueryService {
  constructor(private readonly gateway: DeviceThresholdHttpGateway) {}

  handleGetDeviceThresholdsByDevice(query: GetDeviceThresholdsByDeviceQuery): Observable<DeviceThreshold[]> {
    return this.gateway.getThresholds(query.deviceId.value).pipe(map((resources) => resources.map(deviceThresholdResourceToDomain)));
  }
}

