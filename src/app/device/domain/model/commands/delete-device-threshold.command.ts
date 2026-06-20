import { DeviceId } from '../valueobjects/device-id.value-object';
import { MetricThreshold } from '../valueobjects/metric-threshold.value-object';

export type DeleteDeviceThresholdCommand = Readonly<{
  deviceId: DeviceId;
  metric: MetricThreshold;
}>;

export const createDeleteDeviceThresholdCommand = (deviceId: DeviceId, metric: MetricThreshold): DeleteDeviceThresholdCommand => {
  if (!deviceId) throw new Error('Device ID is required');
  if (!metric) throw new Error('Metric is required');
  return Object.freeze({ deviceId, metric });
};

