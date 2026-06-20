import { UpdateDeviceNameCommand } from '../../../domain/model/commands/update-device-name.command';
import { UpdateDeviceNameResource } from '../resources/update-device-name.resource';

export const updateDeviceNameCommandToResource = (
  command: UpdateDeviceNameCommand
): UpdateDeviceNameResource => {
  return {
    name: command.name,
  };
};
