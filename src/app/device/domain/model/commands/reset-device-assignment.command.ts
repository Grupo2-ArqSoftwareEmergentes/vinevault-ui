import { DeviceId } from '../valueobjects/device-id.value-object';

export type ResetDeviceAssignmentCommand = Readonly<{
  deviceId: DeviceId;
}>;

export const createResetDeviceAssignmentCommand = (deviceId: DeviceId): ResetDeviceAssignmentCommand => {
  return Object.freeze({ deviceId });
};
