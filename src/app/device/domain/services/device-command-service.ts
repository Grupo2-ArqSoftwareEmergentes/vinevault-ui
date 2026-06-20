import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateOrganizationCommand } from '../model/commands/create-organization.command';
import { CreateSpaceCommand } from '../model/commands/create-space.command';
import { ClaimDeviceCommand } from '../model/commands/claim-device.command';
import { PairDeviceCommand } from '../model/commands/pair-device.command';
import { DeleteOrganizationCommand } from '../model/commands/delete-organization.command';
import { DeleteSpaceCommand } from '../model/commands/delete-space.command';
import { ResetDeviceAssignmentCommand } from '../model/commands/reset-device-assignment.command';
import { UpdateSpaceNameCommand } from '../model/commands/update-space-name.command';
import { UpdateOrganizationNameCommand } from '../model/commands/update-organization-name.command';
import { UpdateDeviceNameCommand } from '../model/commands/update-device-name.command';
import { DeleteDeviceCommand } from '../model/commands/delete-device.command';
import { QueueDeviceCommand } from '../model/commands/queue-device-command.command';
import { Organization } from './device-query-service';
import { Space } from './device-query-service';
import { Device } from './device-query-service';
import { DeviceId } from '../model/valueobjects/device-id.value-object';
import { DeviceCommandStatus } from '../model/valueobjects/device-command-status.value-object';
import { DeviceCommandType } from '../model/valueobjects/device-command-type.value-object';

export type DevicePairing = Readonly<{
  deviceId: DeviceId;
  claimToken: string | null;
}>;

export type DeviceCommand = Readonly<{
  id: string;
  deviceId: DeviceId;
  type: DeviceCommandType;
  status: DeviceCommandStatus;
  payload: string | null;
  sentAt: string | null;
  executedAt: string | null;
  failureReason: string | null;
  createdAt: string | null;
}>;

export interface DeviceCommandService {
  handleCreateOrganization(command: CreateOrganizationCommand): Observable<Organization>;
  handleCreateSpace(command: CreateSpaceCommand): Observable<Space>;
  handleClaimDevice(command: ClaimDeviceCommand): Observable<Device>;
  handlePairDevice(command: PairDeviceCommand): Observable<DevicePairing>;
  handleQueueDeviceCommand(command: QueueDeviceCommand): Observable<DeviceCommand>;
  handleDeleteOrganization(command: DeleteOrganizationCommand): Observable<void>;
  handleDeleteSpace(command: DeleteSpaceCommand): Observable<void>;
  handleResetDeviceAssignment(command: ResetDeviceAssignmentCommand): Observable<void>;
  handleUpdateSpaceName(command: UpdateSpaceNameCommand): Observable<void>;
  handleUpdateOrganizationName(command: UpdateOrganizationNameCommand): Observable<void>;
  handleUpdateDeviceName(command: UpdateDeviceNameCommand): Observable<void>;
  handleDeleteDevice(command: DeleteDeviceCommand): Observable<void>;
}


export const DEVICE_COMMAND_SERVICE = new InjectionToken<DeviceCommandService>('DeviceCommandService');
