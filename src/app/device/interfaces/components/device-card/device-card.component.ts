import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Device } from '../../../domain/services/device-query-service';
import { DeviceTelemetrySnapshot } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { resolveDeviceConnectivityColor } from '../../rest/transform/device-connectivity-color.transform';

type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-device-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './device-card.component.html',
  styleUrl: './device-card.component.css',
})
export class DeviceCardComponent {
  @Input() device!: Device;
  @Input() viewMode: ViewMode = 'grid';
  @Input() telemetry: DeviceTelemetrySnapshot | null = null;
  @Output() deviceSelected = new EventEmitter<Device>();

  statusColor(status: string): string {
    switch (status) {
      case 'ONLINE':
        return '#10b981';
      case 'STANDBY':
        return '#6b7280';
      case 'OFFLINE':
        return '#6b7280';
      case 'MAINTENANCE':
        return '#f59e0b';
      case 'ERROR':
        return '#ef4444';
      case 'DECOMMISSIONED':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }

  powerIndicatorColor(): string {
    if (this.device.status === 'ONLINE') return '#10b981';
    if (this.device.status === 'MAINTENANCE') return '#f59e0b';
    if (this.device.status === 'ERROR' || this.device.status === 'DECOMMISSIONED') return '#ef4444';
    return '#6b7280';
  }

  connectivityIndicatorColor(): string {
    return resolveDeviceConnectivityColor(this.telemetry);
  }

  onDeviceClick(): void {
    this.deviceSelected.emit(this.device);
  }
}
