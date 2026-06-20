import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize, switchMap } from 'rxjs';

import { extractApiErrorMessage } from '../../rest/transform/extract-api-error-message.transform';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import {
  MetricThreshold,
  METRIC_THRESHOLD_DEFINITIONS,
  getMetricThresholdDetails,
} from '../../../domain/model/valueobjects/metric-threshold.value-object';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { createGetDeviceThresholdsByDeviceQuery } from '../../../domain/model/queries/get-device-thresholds-by-device.query';
import { DEVICE_THRESHOLD_COMMAND_SERVICE, DeviceThresholdCommandService } from '../../../domain/services/device-threshold-command-service';
import { DEVICE_THRESHOLD_QUERY_SERVICE, DeviceThresholdQueryService } from '../../../domain/services/device-threshold-query-service';

export type EditDeviceThresholdsDialogData = Readonly<{
  deviceId: string;
}>;

type ThresholdRowForm = FormGroup<{
  value: any;
  enabled: any;
}>;

@Component({
  selector: 'app-edit-device-thresholds-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './edit-device-thresholds-dialog.component.html',
  styleUrl: './edit-device-thresholds-dialog.component.css',
})
export class EditDeviceThresholdsDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<EditDeviceThresholdsDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly queryService = inject(DEVICE_THRESHOLD_QUERY_SERVICE) as DeviceThresholdQueryService;
  private readonly commandService = inject(DEVICE_THRESHOLD_COMMAND_SERVICE) as DeviceThresholdCommandService;
  readonly data: EditDeviceThresholdsDialogData = inject(MAT_DIALOG_DATA);

  readonly thresholdDefinitions = METRIC_THRESHOLD_DEFINITIONS;
  readonly metricDetails = getMetricThresholdDetails;

  loading = false;
  saving = false;

  thresholdsByMetric: Partial<Record<MetricThreshold, DeviceThreshold>> = {};

  readonly form = this.fb.group(
    this.thresholdDefinitions.reduce<Record<MetricThreshold, ThresholdRowForm>>((acc, cfg) => {
      acc[cfg.metric] = this.fb.group({
        value: [cfg.defaultValue, [Validators.required, Validators.min(0.01)]],
        enabled: [cfg.defaultEnabled],
      }) as ThresholdRowForm;
      return acc;
    }, {} as Record<MetricThreshold, ThresholdRowForm>)
  );

  ngOnInit(): void {
    this.reload();
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  done(): void {
    this.dialogRef.close(true);
  }

  hasThreshold(metric: MetricThreshold): boolean {
    return Boolean(this.thresholdsByMetric[metric]);
  }

  getMetricForm(metric: MetricThreshold): ThresholdRowForm {
    return this.form.get(metric) as ThresholdRowForm;
  }

  getMetricValue(metric: MetricThreshold): number | null {
    const raw = this.getMetricForm(metric).get('value')?.value;
    return raw === null || raw === undefined || raw === '' ? null : Number(raw);
  }

  reset(): void {
    this.thresholdDefinitions.forEach((cfg) => {
      this.getMetricForm(cfg.metric).patchValue(
        {
          value: cfg.defaultValue,
          enabled: cfg.defaultEnabled,
        },
        { emitEvent: false }
      );
    });
    this.form.markAsPristine();
    this.cdr.markForCheck();
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    let deviceId;
    try {
      deviceId = createDeviceId(this.data.deviceId);
    } catch (error) {
      this.snackBar.open(extractApiErrorMessage(error, 'Invalid device id'), 'Close', { duration: 3500 });
      return;
    }

    this.saving = true;

    const thresholds = this.thresholdDefinitions.map((cfg) => ({
      metric: cfg.metric,
      value: Number(this.getMetricForm(cfg.metric).get('value')?.value),
      enabled: Boolean(this.getMetricForm(cfg.metric).get('enabled')?.value),
    }));

    this.commandService
      .handleSaveDeviceThresholds(deviceId, thresholds)
      .pipe(
        switchMap(() => this.queryService.handleGetDeviceThresholdsByDevice(createGetDeviceThresholdsByDeviceQuery(deviceId))),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (thresholds) => {
          this.thresholdsByMetric = thresholds.reduce<Partial<Record<MetricThreshold, DeviceThreshold>>>((acc, t) => {
            acc[t.metric] = t;
            return acc;
          }, {});
          this.cdr.markForCheck();
          this.snackBar.open('Thresholds saved', 'Close', { duration: 2500 });
          setTimeout(() => this.done(), 0);
        },
        error: (error) => {
          this.snackBar.open(extractApiErrorMessage(error, 'Failed to save thresholds'), 'Close', { duration: 3500 });
        },
      });
  }

  private reload(): void {
    this.loading = true;
    let deviceId;
    try {
      deviceId = createDeviceId(this.data.deviceId);
    } catch (error) {
      this.loading = false;
      this.snackBar.open(extractApiErrorMessage(error, 'Invalid device id'), 'Close', { duration: 3500 });
      return;
    }

    this.queryService
      .handleGetDeviceThresholdsByDevice(createGetDeviceThresholdsByDeviceQuery(deviceId))
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (thresholds) => {
          this.thresholdsByMetric = thresholds.reduce<Partial<Record<MetricThreshold, DeviceThreshold>>>((acc, t) => {
            acc[t.metric] = t;
            return acc;
          }, {});

          this.thresholdDefinitions.forEach((cfg) => {
            const existing = this.thresholdsByMetric[cfg.metric] ?? null;
            this.getMetricForm(cfg.metric).patchValue(
              {
                value: existing ? existing.value : cfg.defaultValue,
                enabled: existing ? existing.enabled : cfg.defaultEnabled,
              },
              { emitEvent: false }
            );
          });

          this.cdr.markForCheck();
        },
        error: (error) => {
          this.snackBar.open(extractApiErrorMessage(error, 'Failed to load thresholds'), 'Close', { duration: 3500 });
        },
      });
  }
}
