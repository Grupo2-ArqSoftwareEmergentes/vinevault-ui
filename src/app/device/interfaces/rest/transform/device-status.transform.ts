import { DeviceStatusResource } from '../resources/device-status.resource';
import { createDeviceStatus } from '../../../domain/model/valueobjects/device-status.value-object';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { DeviceStatusSnapshot } from '../../../domain/services/device-status-query-service';
import { deviceUtcTimestamp } from '../../../domain/model/valueobjects/device-utc';

export const deviceStatusResourceToDomain = (resource: DeviceStatusResource): DeviceStatusSnapshot => {
  return Object.freeze({
    deviceId: createDeviceId(resource.device_id),
    status: createDeviceStatus(resource.status),
    ...(typeof resource.is_online === 'boolean' ? { isOnline: resource.is_online } : {}),
    lastSeenAt: deviceUtcTimestamp(resource.last_seen_at),
  });
};
