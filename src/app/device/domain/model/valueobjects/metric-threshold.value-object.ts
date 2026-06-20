export type MetricThreshold = 'PM25' | 'CO2' | 'TEMPERATURE' | 'HUMIDITY';

export const METRIC_THRESHOLDS: readonly MetricThreshold[] = ['PM25', 'CO2', 'TEMPERATURE', 'HUMIDITY'] as const;

export type MetricThresholdDetails = Readonly<{ label: string; unit: string }>;

export const getMetricThresholdDetails = (metric: MetricThreshold): MetricThresholdDetails => {
  switch (metric) {
    case 'PM25':
      return { label: 'PM2.5', unit: 'µg/m³' };
    case 'CO2':
      return { label: 'CO₂', unit: 'ppm' };
    case 'TEMPERATURE':
      return { label: 'TEMP', unit: '°C' };
    case 'HUMIDITY':
      return { label: 'HUMIDITY', unit: '%' };
  }
};

