import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeviceInfoCardComponent } from '../device-info-card/device-info-card.component';
import { DeviceThresholdsCardComponent } from '../device-thresholds-card/device-thresholds-card.component';
import { Device } from '../../../domain/services/device-query-service';
import { DeviceTelemetrySnapshot } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';

@Component({
  selector: 'app-device-detail-panel',
  standalone: true,
  imports: [
    CommonModule,
    DeviceInfoCardComponent,
    DeviceThresholdsCardComponent,
  ],
  templateUrl: './device-detail-panel.component.html',
  styleUrl: './device-detail-panel.component.css',
})
export class DeviceDetailPanelComponent {
  @Input() device!: Device;
  @Input() telemetry: DeviceTelemetrySnapshot | null = null;
  @Input() thresholds: readonly DeviceThreshold[] | null = null;
  @Output() backRequested = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<void>();
  @Output() deleteRequested = new EventEmitter<void>();
  @Output() powerToggleRequested = new EventEmitter<void>();
  @Output() thresholdsEditRequested = new EventEmitter<void>();

  onBackRequested(): void {
    this.backRequested.emit();
  }

  onEditRequested(): void {
    this.editRequested.emit();
  }

  onDeleteRequested(): void {
    this.deleteRequested.emit();
  }

  onPowerToggleRequested(): void {
    this.powerToggleRequested.emit();
  }

  onEditThresholdsRequested(): void {
    this.thresholdsEditRequested.emit();
  }
}
