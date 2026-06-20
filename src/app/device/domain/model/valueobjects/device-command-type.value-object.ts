export type DeviceCommandType = 'STANDBY' | 'WAKE' | 'RESTART';

export const createDeviceCommandType = (value: string): DeviceCommandType => {
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'STANDBY':
    case 'WAKE':
    case 'RESTART':
      return normalized;
    default:
      throw new Error(`Invalid DeviceCommandType: ${value}`);
  }
};

