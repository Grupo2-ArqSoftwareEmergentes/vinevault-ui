import { Observable } from 'rxjs';
import { InjectionToken } from '@angular/core';
import { OrganizationResource } from '../../../interfaces/rest/resources/organization.resource';
import { SpaceResource } from '../../../interfaces/rest/resources/space.resource';
import { DeviceResource, DevicePageResource } from '../../../interfaces/rest/resources/device.resource';
import { DevicePairingResource } from '../../../interfaces/rest/resources/device-pairing.resource';
import { CreateOrganizationResource } from '../../../interfaces/rest/resources/create-organization.resource';
import { CreateSpaceResource } from '../../../interfaces/rest/resources/create-space.resource';
import { ClaimDeviceResource } from '../../../interfaces/rest/resources/claim-device.resource';
import { PairDeviceResource } from '../../../interfaces/rest/resources/pair-device.resource';
import { UpdateSpaceNameResource } from '../../../interfaces/rest/resources/update-space-name.resource';
import { UpdateOrganizationNameResource } from '../../../interfaces/rest/resources/update-organization-name.resource';
import { UpdateDeviceNameResource } from '../../../interfaces/rest/resources/update-device-name.resource';
import { CreateDeviceCommandResource } from '../../../interfaces/rest/resources/create-device-command.resource';
import { DeviceCommandResource } from '../../../interfaces/rest/resources/device-command.resource';
import { DeviceStatusResource } from '../../../interfaces/rest/resources/device-status.resource';

export interface DeviceGateway {
  createOrganization(resource: CreateOrganizationResource): Observable<OrganizationResource>;
  getOrganizations(): Observable<OrganizationResource[]>;
  getOrganizationById(organizationId: string): Observable<OrganizationResource>;
  deleteOrganization(organizationId: string): Observable<void>;
  updateOrganizationName(organizationId: string, resource: UpdateOrganizationNameResource): Observable<void>;

  createSpace(organizationId: string, resource: CreateSpaceResource): Observable<SpaceResource>;
  getSpacesByOrganization(organizationId: string): Observable<SpaceResource[]>;
  getSpaceById(spaceId: string): Observable<SpaceResource>;
  deleteSpace(spaceId: string): Observable<void>;
  updateSpaceName(spaceId: string, resource: UpdateSpaceNameResource): Observable<void>;

  claimDevice(resource: ClaimDeviceResource): Observable<DeviceResource>;
  pairDevice(resource: PairDeviceResource): Observable<DevicePairingResource>;
  getDevicesBySpace(spaceId: string, page: number, size: number): Observable<DevicePageResource>;
  getDeviceById(deviceId: string): Observable<DeviceResource>;
  deleteDevice(deviceId: string): Observable<void>;
  updateDeviceName(deviceId: string, resource: UpdateDeviceNameResource): Observable<void>;

  createDeviceCommand(deviceId: string, resource: CreateDeviceCommandResource): Observable<DeviceCommandResource>;

  getDeviceStatus(deviceId: string): Observable<DeviceStatusResource>;
}

export const DEVICE_GATEWAY = new InjectionToken<DeviceGateway>('DEVICE_GATEWAY');
