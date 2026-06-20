import { DeviceId } from '../valueobjects/device-id.value-object';

export type GetDeviceByIdQuery = Readonly<{
  deviceId: DeviceId;
}>;

export const createGetDeviceByIdQuery = (
  deviceId: DeviceId
): GetDeviceByIdQuery => {
  return Object.freeze({ deviceId });
};
