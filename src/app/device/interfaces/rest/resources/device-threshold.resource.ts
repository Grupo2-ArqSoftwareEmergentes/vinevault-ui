import { MetricThreshold } from '../../../domain/model/valueobjects/metric-threshold.value-object';

export type DeviceThresholdResource = Readonly<{
  id: string;
  deviceId: string;
  metric: MetricThreshold;
  metricLabel: string;
  metricUnit: string;
  value: number;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}>;
