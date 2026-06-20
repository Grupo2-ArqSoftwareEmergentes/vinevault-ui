export type DeviceStatus =
  | 'OFFLINE'
  | 'ONLINE'
  | 'STANDBY'
  | 'ERROR'
  | 'MAINTENANCE'
  | 'DECOMMISSIONED';

export const createDeviceStatus = (status: string): DeviceStatus => {
  const upper = status.toUpperCase();
  switch (upper) {
    case 'OFFLINE':
    case 'ONLINE':
    case 'STANDBY':
    case 'ERROR':
    case 'MAINTENANCE':
    case 'DECOMMISSIONED':
      return upper;
    default:
      throw new Error(`Invalid device status: ${status}`);
  }
};
