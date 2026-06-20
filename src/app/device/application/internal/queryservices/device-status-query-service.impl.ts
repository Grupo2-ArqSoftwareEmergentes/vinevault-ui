import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { DeviceHttpGateway } from '../../../infrastructure/api/gateways/device-http.gateway';
import { DeviceStatusQueryService, DeviceStatusSnapshot } from '../../../domain/services/device-status-query-service';
import { GetDeviceStatusByIdQuery } from '../../../domain/model/queries/get-device-status-by-id.query';
import { deviceStatusResourceToDomain } from '../../../interfaces/rest/transform/device-status.transform';

@Injectable({ providedIn: 'root' })
export class DeviceStatusQueryServiceImpl implements DeviceStatusQueryService {
  constructor(private readonly gateway: DeviceHttpGateway) {}

  handleGetDeviceStatusById(query: GetDeviceStatusByIdQuery): Observable<DeviceStatusSnapshot | null> {
    return this.gateway.getDeviceStatus(query.deviceId.value).pipe(
      map((resource) => deviceStatusResourceToDomain(resource)),
      catchError(() => of(null))
    );
  }
}
