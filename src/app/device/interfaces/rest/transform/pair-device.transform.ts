import { PairDeviceCommand } from '../../../domain/model/commands/pair-device.command';
import { PairDeviceResource } from '../resources/pair-device.resource';

export const pairDeviceCommandToResource = (
  command: PairDeviceCommand
): PairDeviceResource => {
  return {
    hardware_id: command.hardwareId.value,
  };
};
