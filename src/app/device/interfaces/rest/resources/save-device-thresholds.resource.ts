import { UpdateDeviceThresholdResource } from './update-device-threshold.resource';

export type SaveDeviceThresholdsResource = Readonly<{
  thresholds: readonly UpdateDeviceThresholdResource[];
}>;
