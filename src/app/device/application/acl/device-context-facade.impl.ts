import { Inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { DeviceContextFacade, FacadeOrganization, FacadeSpace, FacadeDevice } from "../../interfaces/acl/device-context-facade";
import { DEVICE_QUERY_SERVICE, DeviceQueryService } from "../../domain/services/device-query-service";
import { createGetCurrentUserOrganizationsQuery } from "../../domain/model/queries/get-current-user-organizations.query";
import { createGetSpacesByOrganizationQuery } from "../../domain/model/queries/get-spaces-by-organization.query";
import { createOrganizationId } from "../../domain/model/valueobjects/organization-id.value-object";
import { createGetDevicesBySpaceQuery } from "../../domain/model/queries/get-devices-by-space.query";
import { createSpaceId } from "../../domain/model/valueobjects/space-id.value-object";

@Injectable({ providedIn: "root" })
export class DeviceContextFacadeImpl implements DeviceContextFacade {
  constructor(@Inject(DEVICE_QUERY_SERVICE) private readonly queryService: DeviceQueryService) {}

  getOrganizations(): Observable<FacadeOrganization[]> {
    const query = createGetCurrentUserOrganizationsQuery();
    return this.queryService.handleGetCurrentUserOrganizations(query).pipe(
      map((orgs) => orgs.map((o) => ({ id: o.id.value, name: o.name })))
    );
  }

  getSpacesByOrganization(organizationId: string): Observable<FacadeSpace[]> {
    const query = createGetSpacesByOrganizationQuery(createOrganizationId(organizationId));
    return this.queryService.handleGetSpacesByOrganization(query).pipe(
      map((spaces) => spaces.map((s) => ({
        id: s.id.value,
        name: s.name,
        organizationId: s.organizationId.value
      })))
    );
  }

  getDevicesBySpace(spaceId: string): Observable<FacadeDevice[]> {
    const query = createGetDevicesBySpaceQuery(createSpaceId(spaceId), 0, 100);
    return this.queryService.handleGetDevicesBySpace(query).pipe(
      map((page) => page.content.map((d) => ({
        id: d.id.value,
        name: d.name,
        serialNumber: d.serialNumber
      })))
    );
  }
}
