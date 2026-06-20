import { HardwareId } from '../valueobjects/hardware-id.value-object';

export type PairDeviceCommand = Readonly<{
  hardwareId: HardwareId;
}>;

export const createPairDeviceCommand = (hardwareId: HardwareId): PairDeviceCommand => {
  return Object.freeze({ hardwareId });
};
