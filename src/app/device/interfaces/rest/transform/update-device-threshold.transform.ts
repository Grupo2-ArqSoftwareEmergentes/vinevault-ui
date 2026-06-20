import { CreateDeviceThresholdCommand } from '../../../domain/model/commands/create-device-threshold.command';
import { UpdateDeviceThresholdCommand } from '../../../domain/model/commands/update-device-threshold.command';
import { UpdateDeviceThresholdResource } from '../resources/update-device-threshold.resource';

export const createDeviceThresholdCommandToResource = (command: CreateDeviceThresholdCommand): UpdateDeviceThresholdResource => {
  return {
    metric: command.metric,
    value: command.value.value,
    enabled: command.enabled,
  };
};

export const updateDeviceThresholdCommandToResource = (command: UpdateDeviceThresholdCommand): UpdateDeviceThresholdResource => {
  return {
    metric: command.metric,
    value: command.value.value,
    enabled: command.enabled,
  };
};
