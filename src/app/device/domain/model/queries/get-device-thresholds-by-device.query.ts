import { DeviceId } from '../valueobjects/device-id.value-object';

export type GetDeviceThresholdsByDeviceQuery = Readonly<{
  deviceId: DeviceId;
}>;

export const createGetDeviceThresholdsByDeviceQuery = (deviceId: DeviceId): GetDeviceThresholdsByDeviceQuery => {
  if (!deviceId) throw new Error('Device ID is required');
  return Object.freeze({ deviceId });
};

