import { MetricThreshold } from '../../../domain/model/valueobjects/metric-threshold.value-object';

export type DeviceThresholdResource = Readonly<{
  id: string;
  device_id: string;
  metric: MetricThreshold;
  metric_label: string;
  metric_unit: string;
  value: number;
  enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}>;
