import { DeviceCommandType } from '../../../domain/model/valueobjects/device-command-type.value-object';

export interface CreateDeviceCommandResource {
  readonly type: DeviceCommandType;
  readonly payload: string | null;
}

