import { DeviceThresholdResource } from "./device-threshold.resource";

export interface DeviceResource {
  readonly id: string;
  readonly serial_number: string;
  readonly name: string;
  readonly status: string;
  readonly space_id: string | null;
  readonly owner_user_id: string | number | null;
  readonly configuration: Record<string, string>;
  readonly thresholds: DeviceThresholdResource[];
  readonly hardware_id: string;
  readonly device_type: string;
  readonly activated_at: string | null;
  readonly last_seen_at: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export interface DevicePageResource {
  readonly items: DeviceResource[];
  readonly page: number;
  readonly size: number;
  readonly total: number;
}
