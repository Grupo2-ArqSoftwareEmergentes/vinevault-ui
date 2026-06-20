import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DeviceGateway } from './device.gateway';
import { OrganizationResource } from '../../../interfaces/rest/resources/organization.resource';
import { SpaceResource } from '../../../interfaces/rest/resources/space.resource';
import { DeviceResource, DevicePageResource } from '../../../interfaces/rest/resources/device.resource';
import { CreateOrganizationResource } from '../../../interfaces/rest/resources/create-organization.resource';
import { CreateSpaceResource } from '../../../interfaces/rest/resources/create-space.resource';
import { ClaimDeviceResource } from '../../../interfaces/rest/resources/claim-device.resource';
import { PairDeviceResource } from '../../../interfaces/rest/resources/pair-device.resource';
import { DevicePairingResource } from '../../../interfaces/rest/resources/device-pairing.resource';
import { UpdateSpaceNameResource } from '../../../interfaces/rest/resources/update-space-name.resource';
import { UpdateOrganizationNameResource } from '../../../interfaces/rest/resources/update-organization-name.resource';
import { UpdateDeviceNameResource } from '../../../interfaces/rest/resources/update-device-name.resource';
import { CreateDeviceCommandResource } from '../../../interfaces/rest/resources/create-device-command.resource';
import { DeviceCommandResource } from '../../../interfaces/rest/resources/device-command.resource';
import { DeviceStatusResource } from '../../../interfaces/rest/resources/device-status.resource';
import { API_CONFIG } from '../../../../api.config';

@Injectable({ providedIn: 'root' })
export class DeviceHttpGateway implements DeviceGateway {
  private readonly deviceUrl = API_CONFIG.baseUrl + API_CONFIG.endpoints.devices;
  private readonly organizationsUrl = API_CONFIG.baseUrl + API_CONFIG.endpoints.organizations;
  private readonly spacesUrl = API_CONFIG.baseUrl + API_CONFIG.endpoints.spaces;

  constructor(private readonly http: HttpClient) {}

  createOrganization(resource: CreateOrganizationResource): Observable<OrganizationResource> {
    return this.http.post<OrganizationResource>(this.organizationsUrl, resource);
  }

  getOrganizations(): Observable<OrganizationResource[]> {
    return this.http.get<OrganizationResource[]>(this.organizationsUrl);
  }

  getOrganizationById(organizationId: string): Observable<OrganizationResource> {
    return this.http.get<OrganizationResource>(`${this.organizationsUrl}/${organizationId}`);
  }

  deleteOrganization(organizationId: string): Observable<void> {
    return this.http.delete<void>(`${this.organizationsUrl}/${organizationId}`);
  }

  updateOrganizationName(organizationId: string, resource: UpdateOrganizationNameResource): Observable<void> {
    return this.http.patch<void>(`${this.organizationsUrl}/${organizationId}/name`, resource);
  }

  createSpace(organizationId: string, resource: CreateSpaceResource): Observable<SpaceResource> {
    return this.http.post<SpaceResource>(`${this.organizationsUrl}/${organizationId}/spaces`, resource);
  }

  getSpacesByOrganization(organizationId: string): Observable<SpaceResource[]> {
    return this.http.get<SpaceResource[]>(`${this.organizationsUrl}/${organizationId}/spaces`);
  }

  getSpaceById(spaceId: string): Observable<SpaceResource> {
    return this.http.get<SpaceResource>(`${this.spacesUrl}/${spaceId}`);
  }

  deleteSpace(spaceId: string): Observable<void> {
    return this.http.delete<void>(`${this.spacesUrl}/${spaceId}`);
  }

  updateSpaceName(spaceId: string, resource: UpdateSpaceNameResource): Observable<void> {
    return this.http.patch<void>(`${this.spacesUrl}/${spaceId}/name`, resource);
  }

  claimDevice(resource: ClaimDeviceResource): Observable<DeviceResource> {
    return this.http.post<DeviceResource>(`${this.deviceUrl}/claim`, resource);
  }

  pairDevice(resource: PairDeviceResource): Observable<DevicePairingResource> {
    return this.http.post<DevicePairingResource>(`${this.deviceUrl}/pair`, resource);
  }

  getDevicesBySpace(spaceId: string, page: number, size: number): Observable<DevicePageResource> {
    const params = new HttpParams()
      .set('space_id', spaceId)
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<DevicePageResource>(this.deviceUrl, { params });
  }

  getDeviceById(deviceId: string): Observable<DeviceResource> {
    return this.http.get<DeviceResource>(`${this.deviceUrl}/${deviceId}`);
  }

  deleteDevice(deviceId: string): Observable<void> {
    return this.http.delete<void>(`${this.deviceUrl}/${deviceId}`);
  }

  updateDeviceName(deviceId: string, resource: UpdateDeviceNameResource): Observable<void> {
    return this.http.patch<void>(`${this.deviceUrl}/${deviceId}/name`, resource);
  }

  createDeviceCommand(deviceId: string, resource: CreateDeviceCommandResource): Observable<DeviceCommandResource> {
    return this.http.post<DeviceCommandResource>(`${this.deviceUrl}/${deviceId}/commands`, resource);
  }

  getDeviceStatus(deviceId: string): Observable<DeviceStatusResource> {
    return this.http.get<DeviceStatusResource>(`${this.deviceUrl}/${deviceId}/status`);
  }
}
