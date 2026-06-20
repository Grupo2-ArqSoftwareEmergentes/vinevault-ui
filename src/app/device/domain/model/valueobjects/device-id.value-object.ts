export type DeviceId = Readonly<{ value: string }>;

export const createDeviceId = (id: string): DeviceId => {
  if (!id || id.trim().length === 0) {
    throw new Error('Device ID must not be empty');
  }
  return Object.freeze({ value: id.trim() });
};
