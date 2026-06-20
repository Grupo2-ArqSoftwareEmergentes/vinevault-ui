import { DeviceThresholdResource } from '../resources/device-threshold.resource';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';

export const deviceThresholdResourceToDomain = (resource: DeviceThresholdResource): DeviceThreshold => {
  return {
    id: resource.id,
    deviceId: createDeviceId(resource.device_id),
    metric: resource.metric,
    metricLabel: resource.metric_label,
    metricUnit: resource.metric_unit,
    value: resource.value,
    enabled: resource.enabled,
    createdAt: resource.created_at ?? null,
    updatedAt: resource.updated_at ?? null,
  };
};
