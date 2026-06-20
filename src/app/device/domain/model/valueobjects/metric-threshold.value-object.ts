export type MetricThreshold = 'temperature_min' | 'temperature_max' | 'humidity_min' | 'humidity_max';

export type MetricThresholdDetails = Readonly<{ label: string; unit: string }>;

export type MetricThresholdDefinition = Readonly<{
  metric: MetricThreshold;
  label: string;
  unit: string;
  defaultValue: number;
  defaultEnabled: boolean;
}>;

export const METRIC_THRESHOLD_DEFINITIONS: readonly MetricThresholdDefinition[] = [
  { metric: 'temperature_min', label: 'Temperature min', unit: 'C', defaultValue: 12, defaultEnabled: true },
  { metric: 'temperature_max', label: 'Temperature max', unit: 'C', defaultValue: 16, defaultEnabled: true },
  { metric: 'humidity_min', label: 'Humidity min', unit: '%', defaultValue: 65, defaultEnabled: true },
  { metric: 'humidity_max', label: 'Humidity max', unit: '%', defaultValue: 80, defaultEnabled: true },
] as const;

export const METRIC_THRESHOLDS: readonly MetricThreshold[] = METRIC_THRESHOLD_DEFINITIONS.map(
  (definition) => definition.metric
) as readonly MetricThreshold[];

export const getMetricThresholdDetails = (metric: MetricThreshold): MetricThresholdDetails => {
  const definition = METRIC_THRESHOLD_DEFINITIONS.find((item) => item.metric === metric);
  return definition ? { label: definition.label, unit: definition.unit } : { label: metric, unit: '' };
};
