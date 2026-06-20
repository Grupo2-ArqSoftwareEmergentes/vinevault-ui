import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of } from 'rxjs';

import { DEVICE_QUERY_SERVICE, Device, DevicePage, DeviceQueryService } from '../../../../device/domain/services/device-query-service';
import { createGetDevicesBySpaceQuery } from '../../../../device/domain/model/queries/get-devices-by-space.query';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';

export type WineCellarDialogData = Readonly<{
  title: string;
  submitLabel: string;
  spaceId: string;
  name?: string;
  description?: string | null;
  temperatureMin?: number | null;
  temperatureMax?: number | null;
  humidityMin?: number | null;
  humidityMax?: number | null;
  currentDeviceId?: string | null;
}>;

export type WineCellarDialogResult = Readonly<{
  name: string;
  description: string | null;
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number;
  humidityMax: number;
  deviceId: string | null;
}>;

@Component({
  selector: 'app-wine-cellar-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatRadioModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './wine-cellar-dialog.component.html',
  styleUrl: './wine-cellar-dialog.component.css',
})
export class WineCellarDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<WineCellarDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly deviceQueryService = inject(DEVICE_QUERY_SERVICE) as DeviceQueryService;
  readonly data: WineCellarDialogData = inject(MAT_DIALOG_DATA);

  loadingDevices = false;
  errorDevices = '';
  devicesPage: DevicePage | null = null;

  readonly form = this.fb.group(
    {
      name: [this.data.name ?? '', [Validators.required, Validators.minLength(1)]],
      description: [this.data.description ?? ''],
      temperatureMin: [this.data.temperatureMin ?? null, [Validators.required]],
      temperatureMax: [this.data.temperatureMax ?? null, [Validators.required]],
      humidityMin: [this.data.humidityMin ?? null, [Validators.required]],
      humidityMax: [this.data.humidityMax ?? null, [Validators.required]],
      deviceId: [this.data.currentDeviceId ?? null],
    },
    { validators: [this.rangeValidator('temperatureMin', 'temperatureMax'), this.rangeValidator('humidityMin', 'humidityMax')] }
  );

  ngOnInit(): void {
    this.loadDevices();
  }

  submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.dialogRef.close({
      name: (value.name ?? '').trim(),
      description: value.description?.trim() ? value.description.trim() : null,
      temperatureMin: Number(value.temperatureMin),
      temperatureMax: Number(value.temperatureMax),
      humidityMin: Number(value.humidityMin),
      humidityMax: Number(value.humidityMax),
      deviceId: value.deviceId ?? null,
    } satisfies WineCellarDialogResult);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  trackByDeviceId(_index: number, device: Device): string {
    return device.id.value;
  }

  get devices(): readonly Device[] {
    return this.devicesPage?.content ?? [];
  }

  private loadDevices(): void {
    this.loadingDevices = true;
    this.errorDevices = '';
    this.cdr.markForCheck();

    this.deviceQueryService
      .handleGetDevicesBySpace(createGetDevicesBySpaceQuery(createSpaceId(this.data.spaceId), 0, 100))
      .pipe(
        catchError(() => {
          this.errorDevices = 'No se pudieron cargar los devices';
          return of(null);
        }),
        finalize(() => {
          this.loadingDevices = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((page) => {
        this.devicesPage = page;
        this.cdr.markForCheck();
      });
  }

  private rangeValidator(minKey: 'temperatureMin' | 'humidityMin', maxKey: 'temperatureMax' | 'humidityMax') {
    return (control: AbstractControl): ValidationErrors | null => {
      const minValue = Number(control.get(minKey)?.value);
      const maxValue = Number(control.get(maxKey)?.value);
      if (Number.isNaN(minValue) || Number.isNaN(maxValue)) return null;
      return minValue <= maxValue ? null : { invalidRange: true };
    };
  }
}
