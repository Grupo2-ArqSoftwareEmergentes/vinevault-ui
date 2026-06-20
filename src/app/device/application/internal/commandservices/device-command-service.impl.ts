import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DeviceCommandService, DevicePairing, DeviceCommand } from '../../../domain/services/device-command-service';
import { DeviceQueryService, Organization, Space, Device } from '../../../domain/services/device-query-service';
import { CreateOrganizationCommand } from '../../../domain/model/commands/create-organization.command';
import { CreateSpaceCommand } from '../../../domain/model/commands/create-space.command';
import { ClaimDeviceCommand } from '../../../domain/model/commands/claim-device.command';
import { PairDeviceCommand } from '../../../domain/model/commands/pair-device.command';
import { DeleteOrganizationCommand } from '../../../domain/model/commands/delete-organization.command';
import { DeleteSpaceCommand } from '../../../domain/model/commands/delete-space.command';
import { ResetDeviceAssignmentCommand } from '../../../domain/model/commands/reset-device-assignment.command';
import { UpdateSpaceNameCommand } from '../../../domain/model/commands/update-space-name.command';
import { UpdateOrganizationNameCommand } from '../../../domain/model/commands/update-organization-name.command';
import { UpdateDeviceNameCommand } from '../../../domain/model/commands/update-device-name.command';
import { DeleteDeviceCommand } from '../../../domain/model/commands/delete-device.command';
import { QueueDeviceCommand } from '../../../domain/model/commands/queue-device-command.command';
import { DeviceHttpGateway } from '../../../infrastructure/api/gateways/device-http.gateway';
import { createOrganizationCommandToResource } from '../../../interfaces/rest/transform/create-organization.transform';
import { createSpaceCommandToResource } from '../../../interfaces/rest/transform/create-space.transform';
import { claimDeviceCommandToResource } from '../../../interfaces/rest/transform/claim-device.transform';
import { pairDeviceCommandToResource } from '../../../interfaces/rest/transform/pair-device.transform';
import { updateSpaceNameCommandToResource } from '../../../interfaces/rest/transform/update-space-name.transform';
import { updateOrganizationNameCommandToResource } from '../../../interfaces/rest/transform/update-organization-name.transform';
import { updateDeviceNameCommandToResource } from '../../../interfaces/rest/transform/update-device-name.transform';
import { organizationResourceToDomain } from '../../../interfaces/rest/transform/organization.transform';
import { spaceResourceToDomain } from '../../../interfaces/rest/transform/space.transform';
import { deviceResourceToDomain } from '../../../interfaces/rest/transform/device.transform';
import { devicePairingResourceToDomain } from '../../../interfaces/rest/transform/device-pairing.transform';
import { queueDeviceCommandToResource } from '../../../interfaces/rest/transform/queue-device-command.transform';
import { deviceCommandResourceToDomain } from '../../../interfaces/rest/transform/device-command.transform';

@Injectable({ providedIn: 'root' })
export class DeviceCommandServiceImpl implements DeviceCommandService {
  constructor(private readonly deviceGateway: DeviceHttpGateway) {}

  handleCreateOrganization(command: CreateOrganizationCommand): Observable<Organization> {
    return this.deviceGateway
      .createOrganization(createOrganizationCommandToResource(command))
      .pipe(map((resource) => organizationResourceToDomain(resource)));
  }

  handleCreateSpace(command: CreateSpaceCommand): Observable<Space> {
    return this.deviceGateway
      .createSpace(command.organizationId.value, createSpaceCommandToResource(command))
      .pipe(map((resource) => spaceResourceToDomain(resource)));
  }

  handleClaimDevice(command: ClaimDeviceCommand): Observable<Device> {
    return this.deviceGateway
      .claimDevice(claimDeviceCommandToResource(command))
      .pipe(map((resource) => deviceResourceToDomain(resource)));
  }

  handlePairDevice(command: PairDeviceCommand): Observable<DevicePairing> {
    return this.deviceGateway
      .pairDevice(pairDeviceCommandToResource(command))
      .pipe(map((resource) => devicePairingResourceToDomain(resource)));
  }

  handleQueueDeviceCommand(command: QueueDeviceCommand): Observable<DeviceCommand> {
    return this.deviceGateway
      .createDeviceCommand(command.deviceId.value, queueDeviceCommandToResource(command))
      .pipe(map((resource) => deviceCommandResourceToDomain(resource)));
  }

  handleDeleteOrganization(command: DeleteOrganizationCommand): Observable<void> {
    return this.deviceGateway.deleteOrganization(command.organizationId.value);
  }

  handleDeleteSpace(command: DeleteSpaceCommand): Observable<void> {
    return this.deviceGateway.deleteSpace(command.spaceId.value);
  }

  handleResetDeviceAssignment(command: ResetDeviceAssignmentCommand): Observable<void> {
    return this.deviceGateway.deleteDevice(command.deviceId.value);
  }

  handleUpdateSpaceName(command: UpdateSpaceNameCommand): Observable<void> {
    return this.deviceGateway.updateSpaceName(
      command.spaceId.value,
      updateSpaceNameCommandToResource(command)
    );
  }

  handleUpdateOrganizationName(command: UpdateOrganizationNameCommand): Observable<void> {
    return this.deviceGateway.updateOrganizationName(
      command.organizationId.value,
      updateOrganizationNameCommandToResource(command)
    );
  }

  handleUpdateDeviceName(command: UpdateDeviceNameCommand): Observable<void> {
    return this.deviceGateway.updateDeviceName(
      command.deviceId.value,
      updateDeviceNameCommandToResource(command)
    );
  }

  handleDeleteDevice(command: DeleteDeviceCommand): Observable<void> {
    return this.deviceGateway.deleteDevice(command.deviceId.value);
  }
}
