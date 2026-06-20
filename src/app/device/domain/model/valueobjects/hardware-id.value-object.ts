export type HardwareId = Readonly<{ value: string }>;

export const createHardwareId = (value: string): HardwareId => {
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) {
    throw new Error('Hardware ID must not be empty');
  }

  // Backend-supported formats:
  // - Factory/edge: CLAIR-0KBG (4 chars, uppercase alphanumeric)
  // - Legacy:       HW-0001  (4 digits)
  const isClairFormat = /^CLAIR-[0-9A-Z]{4}$/.test(normalized);
  const isLegacyFormat = /^HW-\d{4}$/.test(normalized);
  if (!isClairFormat && !isLegacyFormat) {
    throw new Error('Hardware ID must match CLAIR-0KBG or HW-0001');
  }
  return Object.freeze({ value: normalized });
};
