import { DeviceId } from '../valueobjects/device-id.value-object';

export type GetDeviceStatusByIdQuery = Readonly<{
  deviceId: DeviceId;
}>;

export const createGetDeviceStatusByIdQuery = (deviceId: DeviceId): GetDeviceStatusByIdQuery => {
  return Object.freeze({ deviceId });
};

