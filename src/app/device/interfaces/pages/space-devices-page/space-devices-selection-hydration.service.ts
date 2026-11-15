import { DEVICE_QUERY_SERVICE, DeviceQueryService } from '../../../domain/services/device-query-service';
import { Inject } from '@angular/core';
import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';

import { Device } from '../../../domain/services/device-query-service';
import { WorkspaceSpace as Space } from '../../../../shared/models/workspace-context';
import { WorkspaceApiService } from '../../../../shared/services/workspace-api.service';
import { createGetDeviceByIdQuery } from '../../../domain/model/queries/get-device-by-id.query';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { SpaceId, createSpaceId } from '../../../domain/model/valueobjects/space-id.value-object';

export type HydratedDeviceSelection = Readonly<{
  device: Device;
  space: Space | null;
}>;

@Injectable({ providedIn: 'root' })
export class SpaceDevicesSelectionHydrationService {
  constructor(@Inject(DEVICE_QUERY_SERVICE) private readonly deviceQueryService: DeviceQueryService, private readonly workspaceApi: WorkspaceApiService) {}

  hydrateFromDeviceId(deviceId: string): Observable<HydratedDeviceSelection | null> {
    let parsedDeviceId;
    try {
      parsedDeviceId = createDeviceId(deviceId);
    } catch {
      return of(null);
    }

    return this.deviceQueryService.handleGetDeviceById(createGetDeviceByIdQuery(parsedDeviceId)).pipe(
      switchMap((device) => {
        if (!device) return of(null);
        if (!device.spaceId) return of(Object.freeze({ device, space: null }));

        return this.hydrateFromSpaceId(device.spaceId).pipe(
          map((space) => Object.freeze({ device, space }))
        );
      })
    );
  }

  hydrateFromSpaceId(spaceId: string | SpaceId): Observable<Space | null> {
    let parsedSpaceId: SpaceId;
    try {
      parsedSpaceId = typeof spaceId === 'string' ? createSpaceId(spaceId) : spaceId;
    } catch {
      return of(null);
    }

    return this.workspaceApi.getSpaces().pipe(map((spaces) => spaces.find((space) => space.id.value === parsedSpaceId.value) ?? null));
  }
}

