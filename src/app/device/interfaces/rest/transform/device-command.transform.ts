import { DeviceCommand } from '../../../domain/services/device-command-service';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { DeviceCommandResource } from '../resources/device-command.resource';

export const deviceCommandResourceToDomain = (resource: DeviceCommandResource): DeviceCommand => {
  return Object.freeze({
    id: resource.id,
    deviceId: createDeviceId(resource.device_id),
    type: resource.type,
    status: resource.status,
    payload: resource.payload,
    sentAt: resource.sent_at,
    executedAt: resource.executed_at,
    failureReason: resource.failure_reason,
    createdAt: resource.created_at,
  });
};

