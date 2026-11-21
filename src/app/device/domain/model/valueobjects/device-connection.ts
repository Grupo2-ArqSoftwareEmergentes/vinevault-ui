import { DeviceStatus } from './device-status.value-object';

/** Core evaluates UTC freshness. RSSI/network names must never override power intent. */
export function deviceConnectionStatus(device: { status: DeviceStatus; isOnline?: boolean }): DeviceStatus {
  if (['STANDBY', 'MAINTENANCE', 'DECOMMISSIONED'].includes(device.status)) return device.status;
  if (device.isOnline === true) return 'ONLINE';
  if (device.isOnline === false && device.status === 'ONLINE') return 'OFFLINE';
  return device.status; // Compatibility with older Core responses, not a guessed timestamp.
}

export function deviceConnectionLabel(device: { status: DeviceStatus; isOnline?: boolean }): string {
  switch (deviceConnectionStatus(device)) {
    case 'ONLINE': return 'En línea';
    case 'STANDBY': return 'En espera';
    case 'OFFLINE': return 'Sin conexión';
    case 'MAINTENANCE': return 'Mantenimiento';
    case 'ERROR': return 'Error del dispositivo';
    case 'DECOMMISSIONED': return 'Retirado';
  }
}
