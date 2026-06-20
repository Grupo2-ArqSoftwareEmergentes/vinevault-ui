import { DevicePairing } from '../../../domain/services/device-command-service';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { DevicePairingResource } from '../resources/device-pairing.resource';

export const devicePairingResourceToDomain = (resource: DevicePairingResource): DevicePairing => {
  return Object.freeze({
    deviceId: createDeviceId(resource.device_id),
    claimToken: resource.claim_token,
  });
};
