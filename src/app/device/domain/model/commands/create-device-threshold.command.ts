import { DeviceId } from '../valueobjects/device-id.value-object';
import { MetricThreshold } from '../valueobjects/metric-threshold.value-object';
import { ThresholdValue, createThresholdValue } from '../valueobjects/threshold-value.value-object';

export type CreateDeviceThresholdCommand = Readonly<{
  deviceId: DeviceId;
  metric: MetricThreshold;
  value: ThresholdValue;
  enabled: boolean;
}>;

export const createCreateDeviceThresholdCommand = (
  deviceId: DeviceId,
  metric: MetricThreshold,
  value: number,
  enabled: boolean
): CreateDeviceThresholdCommand => {
  if (!deviceId) throw new Error('Device ID is required');
  if (!metric) throw new Error('Metric is required');
  return Object.freeze({
    deviceId,
    metric,
    value: createThresholdValue(value),
    enabled: Boolean(enabled),
  });
};
