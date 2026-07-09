import { DeviceAlertResource } from '../resources/device-alert.resource';
import { DeviceAlert } from '../../../domain/services/device-alert-query-service';
import { createDeviceId } from '../../../../device/domain/model/valueobjects/device-id.value-object';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';

export const deviceAlertResourceToDomain = (resource: DeviceAlertResource): DeviceAlert => {
  return Object.freeze({
    id: resource.id,
    deviceId: createDeviceId(resource.device_id),
    assignmentId: resource.assignment_id,
    spaceId: resource.space_id ? createSpaceId(resource.space_id) : null,
    metric: resource.metric,
    thresholdMetric: resource.threshold_metric,
    thresholdValue: resource.threshold_value,
    actualValue: resource.actual_value,
    message: resource.message,
    status: resource.status,
    occurredAt: resource.occurred_at,
    resolvedAt: resource.resolved_at,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  });
};

