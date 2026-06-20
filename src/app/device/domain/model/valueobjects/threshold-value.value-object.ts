export type ThresholdValue = Readonly<{ value: number }>;

export const createThresholdValue = (value: number): ThresholdValue => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    throw new Error('Threshold value must be a number');
  }
  if (value <= 0) {
    throw new Error('Threshold value must be greater than 0');
  }
  return Object.freeze({ value });
};

