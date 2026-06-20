export type HardwareId = Readonly<{ value: string }>;

export const createHardwareId = (value: string): HardwareId => {
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) {
    throw new Error('Hardware ID must not be empty');
  }

  // Backend-supported formats:
  // - Fixed/random: VINE-A001 ... VINE-A005, VINE-XXXX, etc.
  const isVineFormat = /^VINE-[0-9A-Z]{4}$/.test(normalized);
  if (!isVineFormat) {
    throw new Error('Hardware ID must match VINE-A001 or VINE-XXXX');
  }
  return Object.freeze({ value: normalized });
};
