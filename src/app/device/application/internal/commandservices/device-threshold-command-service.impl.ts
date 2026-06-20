import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DeviceThresholdCommandService } from '../../../domain/services/device-threshold-command-service';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import { CreateDeviceThresholdCommand } from '../../../domain/model/commands/create-device-threshold.command';
import { UpdateDeviceThresholdCommand } from '../../../domain/model/commands/update-device-threshold.command';
import { DeleteDeviceThresholdCommand } from '../../../domain/model/commands/delete-device-threshold.command';
import { DeviceThresholdHttpGateway } from '../../../infrastructure/api/gateways/device-threshold-http.gateway';
import { createDeviceThresholdCommandToResource, updateDeviceThresholdCommandToResource } from '../../../interfaces/rest/transform/update-device-threshold.transform';
import { deviceThresholdResourceToDomain } from '../../../interfaces/rest/transform/device-threshold.transform';
import { deviceThresholdInputsToSaveResource } from '../../../interfaces/rest/transform/save-device-thresholds.transform';
import { DeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { DeviceThresholdInput } from '../../../domain/services/device-threshold-command-service';

@Injectable({ providedIn: 'root' })
export class DeviceThresholdCommandServiceImpl implements DeviceThresholdCommandService {
  constructor(private readonly gateway: DeviceThresholdHttpGateway) {}

  handleCreateDeviceThreshold(command: CreateDeviceThresholdCommand): Observable<DeviceThreshold> {
    return this.gateway
      .createThreshold(command.deviceId.value, createDeviceThresholdCommandToResource(command))
      .pipe(map(deviceThresholdResourceToDomain));
  }

  handleUpdateDeviceThreshold(command: UpdateDeviceThresholdCommand): Observable<DeviceThreshold> {
    return this.gateway
      .updateThreshold(command.deviceId.value, command.metric, updateDeviceThresholdCommandToResource(command))
      .pipe(map(deviceThresholdResourceToDomain));
  }

  handleDeleteDeviceThreshold(command: DeleteDeviceThresholdCommand): Observable<void> {
    return this.gateway.deleteThreshold(command.deviceId.value, command.metric);
  }

  handleSaveDeviceThresholds(deviceId: DeviceId, thresholds: readonly DeviceThresholdInput[]): Observable<void> {
    return this.gateway.saveThresholds(deviceId.value, deviceThresholdInputsToSaveResource(thresholds));
  }
}

