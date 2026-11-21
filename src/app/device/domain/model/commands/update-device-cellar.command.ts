import { DeviceId } from '../valueobjects/device-id.value-object';

export interface UpdateDeviceCellarCommand {
  readonly deviceId: DeviceId;
  readonly cellarId: string | null;
}
