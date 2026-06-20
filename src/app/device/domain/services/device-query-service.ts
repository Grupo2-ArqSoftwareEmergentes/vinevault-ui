import { InjectionToken } from '@angular/core';
import { Observable } from "rxjs";
import { GetCurrentUserOrganizationsQuery } from "../model/queries/get-current-user-organizations.query";
import { GetOrganizationByIdQuery } from "../model/queries/get-organization-by-id.query";
import { GetSpacesByOrganizationQuery } from "../model/queries/get-spaces-by-organization.query";
import { GetSpaceByIdQuery } from "../model/queries/get-space-by-id.query";
import { GetDevicesBySpaceQuery } from "../model/queries/get-devices-by-space.query";
import { GetDeviceByIdQuery } from "../model/queries/get-device-by-id.query";
import { OrganizationId } from "../model/valueobjects/organization-id.value-object";
import { SpaceId } from "../model/valueobjects/space-id.value-object";
import { DeviceId } from "../model/valueobjects/device-id.value-object";
import { DeviceStatus } from "../model/valueobjects/device-status.value-object";
import { UserId } from "../model/valueobjects/user-id.value-object";
import { HardwareId } from "../model/valueobjects/hardware-id.value-object";
import { DeviceThreshold } from "./device-threshold-query-service";

export type Organization = Readonly<{
  id: OrganizationId;
  name: string;
  ownerUserId: UserId;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type Space = Readonly<{
  id: SpaceId;
  name: string;
  organizationId: OrganizationId;
  ownerUserId: UserId;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type Device = Readonly<{
  id: DeviceId;
  serialNumber: string;
  name: string;
  status: DeviceStatus;
  spaceId: SpaceId | null;
  ownerUserId: UserId | null;
  configuration: Record<string, string>;
  thresholds: readonly DeviceThreshold[];
  hardwareId: HardwareId;
  deviceType: string;
  activatedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type DevicePage = Readonly<{
  content: readonly Device[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}>;

export interface DeviceQueryService {
  handleGetCurrentUserOrganizations(query: GetCurrentUserOrganizationsQuery): Observable<Organization[]>;
  handleGetOrganizationById(query: GetOrganizationByIdQuery): Observable<Organization | null>;
  handleGetSpacesByOrganization(query: GetSpacesByOrganizationQuery): Observable<Space[]>;
  handleGetSpaceById(query: GetSpaceByIdQuery): Observable<Space | null>;
  handleGetDevicesBySpace(query: GetDevicesBySpaceQuery): Observable<DevicePage>;
  handleGetDeviceById(query: GetDeviceByIdQuery): Observable<Device | null>;
}


export const DEVICE_QUERY_SERVICE = new InjectionToken<DeviceQueryService>('DeviceQueryService');
