import { DeviceId } from '../valueobjects/device-id.value-object';

export type DeleteDeviceCommand = Readonly<{
  deviceId: DeviceId;
}>;

export const createDeleteDeviceCommand = (
  deviceId: DeviceId
): DeleteDeviceCommand => {
  return Object.freeze({ deviceId });
};
