import { MetricThreshold } from '../../../domain/model/valueobjects/metric-threshold.value-object';

export type UpdateDeviceThresholdResource = Readonly<{
  metric: MetricThreshold;
  value: number;
  enabled: boolean;
}>;
