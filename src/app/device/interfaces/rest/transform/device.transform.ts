import { DeviceResource, DevicePageResource } from "../resources/device.resource";
import { Device, DevicePage } from "../../../domain/services/device-query-service";
import { createDeviceId } from "../../../domain/model/valueobjects/device-id.value-object";
import { createSpaceId } from "../../../domain/model/valueobjects/space-id.value-object";
import { createDeviceStatus } from "../../../domain/model/valueobjects/device-status.value-object";
import { createUserId } from "../../../domain/model/valueobjects/user-id.value-object";
import { createHardwareId } from "../../../domain/model/valueobjects/hardware-id.value-object";
import { deviceThresholdResourceToDomain } from "./device-threshold.transform";

export const deviceResourceToDomain = (resource: DeviceResource): Device => {
  return Object.freeze({
    id: createDeviceId(resource.id),
    serialNumber: resource.serial_number,
    name: resource.name,
    status: createDeviceStatus(resource.status),
    spaceId: resource.space_id ? createSpaceId(resource.space_id) : null,
    ownerUserId: resource.owner_user_id ? createUserId(resource.owner_user_id) : null,
    configuration: Object.freeze({ ...resource.configuration }),
    thresholds: Object.freeze((resource.thresholds || []).map(deviceThresholdResourceToDomain)),
    hardwareId: createHardwareId(resource.hardware_id),
    deviceType: resource.device_type,
    activatedAt: resource.activated_at,
    lastSeenAt: resource.last_seen_at,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  });
};

export const devicePageResourceToDomain = (resource: DevicePageResource): DevicePage => {
  const totalPages = resource.size > 0 ? Math.ceil(resource.total / resource.size) : 0;
  return Object.freeze({
    content: Object.freeze(resource.items.map(deviceResourceToDomain)),
    totalElements: resource.total,
    totalPages,
    size: resource.size,
    number: resource.page,
  });
};
