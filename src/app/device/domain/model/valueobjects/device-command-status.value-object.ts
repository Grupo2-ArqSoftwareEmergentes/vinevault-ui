export type DeviceCommandStatus = 'PENDING' | 'SENT' | 'EXECUTED' | 'FAILED' | 'EXPIRED';

export const createDeviceCommandStatus = (value: string): DeviceCommandStatus => {
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'PENDING':
    case 'SENT':
    case 'EXECUTED':
    case 'FAILED':
    case 'EXPIRED':
      return normalized;
    default:
      throw new Error(`Invalid DeviceCommandStatus: ${value}`);
  }
};

