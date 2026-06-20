import { DeviceTelemetrySnapshot } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';

export const resolveDeviceConnectivityColor = (telemetry: DeviceTelemetrySnapshot | null): string => {
  if (!telemetry) return '#9ca3af';

  const status = (telemetry.connectivityStatus ?? '').trim().toUpperCase();
  const signalStrength = telemetry.connectivitySignalStrength;
  if (!status) return '#9ca3af';

  const isConnected = status.includes('CONNECTED') || status.includes('ONLINE') || status.includes('UP');
  if (!isConnected) return '#6b7280';
  if (signalStrength == null) return '#10b981';

  if (signalStrength >= -70) return '#10b981';
  if (signalStrength >= -85) return '#f59e0b';
  return '#ef4444';
};
