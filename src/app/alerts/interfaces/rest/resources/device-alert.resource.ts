export interface DeviceAlertResource {
  readonly id: string;
  readonly device_id: string;
  readonly assignment_id: string | null;
  readonly space_id: string | null;
  readonly metric: string;
  readonly threshold_metric: string;
  readonly threshold_value: string;
  readonly actual_value: string;
  readonly message: string;
  readonly status: string;
  readonly occurred_at: string;
  readonly resolved_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

