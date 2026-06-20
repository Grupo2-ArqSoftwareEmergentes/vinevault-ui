import { DEVICE_QUERY_SERVICE, DeviceQueryService } from '../../../domain/services/device-query-service';
import { Inject } from '@angular/core';
import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { Device, Space } from '../../../domain/services/device-query-service';
import { createGetCurrentUserOrganizationsQuery } from '../../../domain/model/queries/get-current-user-organizations.query';
import { createGetDeviceByIdQuery } from '../../../domain/model/queries/get-device-by-id.query';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { SpaceId, createSpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { createGetSpacesByOrganizationQuery } from '../../../domain/model/queries/get-spaces-by-organization.query';

export type HydratedDeviceSelection = Readonly<{
  device: Device;
  space: Space | null;
}>;

@Injectable({ providedIn: 'root' })
export class SpaceDevicesSelectionHydrationService {
  constructor(@Inject(DEVICE_QUERY_SERVICE) private readonly deviceQueryService: DeviceQueryService) {}

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

    return this.deviceQueryService.handleGetCurrentUserOrganizations(createGetCurrentUserOrganizationsQuery()).pipe(
      switchMap((organizations) => {
        if (organizations.length === 0) return of(null);

        const requests = organizations.map((organization) =>
          this.deviceQueryService.handleGetSpacesByOrganization(
            createGetSpacesByOrganizationQuery(organization.id)
          ).pipe(
            map((spaces) => spaces.find((space) => space.id.value === parsedSpaceId.value) ?? null),
            catchError(() => of(null))
          )
        );

        return forkJoin(requests).pipe(
          map((spaces) => spaces.find((space): space is Space => space !== null) ?? null)
        );
      })
    );
  }
}

