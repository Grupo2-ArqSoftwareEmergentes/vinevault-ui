import { DeviceId } from '../valueobjects/device-id.value-object';

export type UpdateDeviceNameCommand = Readonly<{
  deviceId: DeviceId;
  name: string;
}>;

export const createUpdateDeviceNameCommand = (
  deviceId: DeviceId,
  name: string
): UpdateDeviceNameCommand => {
  if (!name || name.trim().length === 0) {
    throw new Error('Device name must not be empty');
  }
  return Object.freeze({ deviceId, name: name.trim() });
};
