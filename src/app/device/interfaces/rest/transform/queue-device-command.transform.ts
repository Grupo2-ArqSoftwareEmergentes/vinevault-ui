import { QueueDeviceCommand } from '../../../domain/model/commands/queue-device-command.command';
import { CreateDeviceCommandResource } from '../resources/create-device-command.resource';

export const queueDeviceCommandToResource = (command: QueueDeviceCommand): CreateDeviceCommandResource => {
  return {
    type: command.type,
    payload: command.payload ?? null,
  };
};

