export interface DeviceStatusResource {
  readonly device_id: string;
  readonly status: string;
  readonly last_seen_at: string | null;
}

