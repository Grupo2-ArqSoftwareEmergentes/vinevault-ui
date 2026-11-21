import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { DeviceAlertQueryService, DeviceAlert } from '../../../domain/services/device-alert-query-service';
import { GetDeviceAlertsByDeviceQuery } from '../../../domain/model/queries/get-device-alerts-by-device.query';
import { DeviceAlertHttpGateway } from '../../../infrastructure/api/gateways/device-alert-http.gateway';
import { deviceAlertResourceToDomain } from '../../../interfaces/rest/transform/device-alert.transform';
import { SpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';

@Injectable({ providedIn: 'root' })
export class DeviceAlertQueryServiceImpl implements DeviceAlertQueryService {
  constructor(private readonly gateway: DeviceAlertHttpGateway) {}

  handleGetAlertsBySpace(spaceId: SpaceId, activeOnly = false): Observable<readonly DeviceAlert[]> {
    // Propagate errors: an unavailable space is not an empty alert directory.
    return this.gateway.getSpaceAlerts(spaceId.value, activeOnly).pipe(
      map(resources => resources.map(deviceAlertResourceToDomain))
    );
  }

  handleGetDeviceAlertsByDevice(query: GetDeviceAlertsByDeviceQuery): Observable<readonly DeviceAlert[]> {
    return this.gateway.getDeviceAlerts(query.deviceId.value, query.activeOnly).pipe(
      map((resources) => resources.map(deviceAlertResourceToDomain)),
      catchError(() => of([]))
    );
  }
}

