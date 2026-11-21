import { I18nModule } from '../../../../core/i18n/i18n.module';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanSpaceDirective } from '../../../../shared/directives/can-space.directive';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DeviceTelemetrySnapshot } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import { MetricThreshold, getMetricThresholdDetails, METRIC_THRESHOLDS } from '../../../domain/model/valueobjects/metric-threshold.value-object';

@Component({
  selector: 'app-device-thresholds-card',
  standalone: true,
  imports: [
    I18nModule,
    CanSpaceDirective,
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './device-thresholds-card.component.html',
  styleUrl: './device-thresholds-card.component.css',
})
export class DeviceThresholdsCardComponent {
  @Input() deviceId: string = '';
  @Input() telemetry: DeviceTelemetrySnapshot | null = null;
  @Input() thresholds: readonly DeviceThreshold[] | null = null;
  @Output() editRequested = new EventEmitter<void>();

  readonly metrics = METRIC_THRESHOLDS;
  readonly metricDetails = getMetricThresholdDetails;

  thresholdFor(metric: MetricThreshold): DeviceThreshold | null {
    const thresholds = this.thresholds ?? [];
    return thresholds.find((t) => t.metric === metric) ?? null;
  }

  editThresholds(): void {
    this.editRequested.emit();
  }
}
