import { DeviceCommandStatus } from '../../../domain/model/valueobjects/device-command-status.value-object';
import { DeviceCommandType } from '../../../domain/model/valueobjects/device-command-type.value-object';

export interface DeviceCommandResource {
  readonly id: string;
  readonly device_id: string;
  readonly type: DeviceCommandType;
  readonly status: DeviceCommandStatus;
  readonly payload: string | null;
  readonly sent_at: string | null;
  readonly executed_at: string | null;
  readonly failure_reason: string | null;
  readonly created_at: string | null;
}

