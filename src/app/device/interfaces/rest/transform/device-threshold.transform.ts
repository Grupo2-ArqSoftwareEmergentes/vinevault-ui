import { DeviceThresholdResource } from '../resources/device-threshold.resource';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';

export const deviceThresholdResourceToDomain = (resource: DeviceThresholdResource): DeviceThreshold => {
  return {
    id: resource.id,
    deviceId: createDeviceId(resource.deviceId),
    metric: resource.metric,
    metricLabel: resource.metricLabel,
    metricUnit: resource.metricUnit,
    value: resource.value,
    enabled: resource.enabled,
    createdAt: resource.createdAt ?? null,
    updatedAt: resource.updatedAt ?? null,
  };
};
