import { DeviceId } from '../../../../device/domain/model/valueobjects/device-id.value-object';

export type GetDeviceAlertsByDeviceQuery = Readonly<{
  deviceId: DeviceId;
  activeOnly: boolean;
}>;

export const createGetDeviceAlertsByDeviceQuery = (
  deviceId: DeviceId,
  activeOnly: boolean = false
): GetDeviceAlertsByDeviceQuery => {
  return Object.freeze({
    deviceId,
    activeOnly,
  });
};

