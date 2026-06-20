import { SaveDeviceThresholdsResource } from '../resources/save-device-thresholds.resource';
import { UpdateDeviceThresholdResource } from '../resources/update-device-threshold.resource';
import { DeviceThresholdInput } from '../../../domain/services/device-threshold-command-service';

export const deviceThresholdInputsToSaveResource = (
  thresholds: readonly DeviceThresholdInput[]
): SaveDeviceThresholdsResource => {
  const items: UpdateDeviceThresholdResource[] = thresholds.map((threshold) => ({
    metric: threshold.metric,
    value: threshold.value,
    enabled: threshold.enabled,
  }));

  return { thresholds: items };
};
