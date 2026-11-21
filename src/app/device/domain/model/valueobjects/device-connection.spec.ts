import { deviceConnectionLabel, deviceConnectionStatus } from './device-connection';
import { deviceStatusResourceToDomain } from '../../../interfaces/rest/transform/device-status.transform';

describe('Server-evaluated device connectivity', () => {
  it('maps the explicit is_online flag without dropping false and keeps compatibility with older Core', () => {
    for (const is_online of [false, true]) {
      const snapshot = deviceStatusResourceToDomain({ device_id: 'sensor-1', status: 'ONLINE', last_seen_at: '2026-11-21T12:00:00Z', is_online });
      expect(snapshot.isOnline).toBe(is_online);
      expect(deviceConnectionStatus(snapshot)).toBe(is_online ? 'ONLINE' : 'OFFLINE');
    }
    expect(deviceConnectionStatus({ status: 'ONLINE' })).toBe('ONLINE');
    expect(deviceConnectionStatus({ status: 'OFFLINE' })).toBe('OFFLINE');
  });
  it('never overrides explicit off/disabled modes with cached connectivity', () => {
    for (const status of ['STANDBY', 'MAINTENANCE', 'DECOMMISSIONED'] as const) expect(deviceConnectionStatus({ status, isOnline: true })).toBe(status);
    expect(deviceConnectionLabel({ status: 'OFFLINE', isOnline: true })).toBe('En línea');
    expect(deviceConnectionLabel({ status: 'ONLINE', isOnline: false })).toBe('Sin conexión');
  });
});
