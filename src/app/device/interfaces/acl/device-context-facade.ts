import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface FacadeOrganization {
  readonly id: string;
  readonly name: string;
}

export interface FacadeSpace {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
}

export interface FacadeDevice {
  readonly id: string;
  readonly name: string;
  readonly serialNumber: string;
}

export interface DeviceContextFacade {
  getOrganizations(): Observable<FacadeOrganization[]>;
  getSpacesByOrganization(organizationId: string): Observable<FacadeSpace[]>;
  getDevicesBySpace(spaceId: string): Observable<FacadeDevice[]>;
}

export const DEVICE_CONTEXT_FACADE = new InjectionToken<DeviceContextFacade>(
  'DEVICE_CONTEXT_FACADE'
);
