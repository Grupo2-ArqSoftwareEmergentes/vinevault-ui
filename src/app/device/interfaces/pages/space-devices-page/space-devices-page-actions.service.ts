import { Inject } from '@angular/core';
import { DEVICE_THRESHOLD_QUERY_SERVICE, DeviceThresholdQueryService } from '../../../domain/services/device-threshold-query-service';
import { DEVICE_STATUS_QUERY_SERVICE, DeviceStatusQueryService } from '../../../domain/services/device-status-query-service';
import { DEVICE_QUERY_SERVICE, DeviceQueryService } from '../../../domain/services/device-query-service';
import { DEVICE_COMMAND_SERVICE, DeviceCommandService } from '../../../domain/services/device-command-service';
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, from, of, switchMap, tap, interval, startWith, catchError, map, mergeMap } from 'rxjs';
import { reduce } from 'rxjs/operators';
import { ExternalTelemetryEvaluationService, DeviceTelemetrySnapshot } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { Device, DevicePage, Space } from '../../../domain/services/device-query-service';
import { DeviceStatusSnapshot } from '../../../domain/services/device-status-query-service';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import { SpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { createGetDevicesBySpaceQuery } from '../../../domain/model/queries/get-devices-by-space.query';
import { createClaimDeviceCommand } from '../../../domain/model/commands/claim-device.command';
import { createPairDeviceCommand } from '../../../domain/model/commands/pair-device.command';
import { createHardwareId } from '../../../domain/model/valueobjects/hardware-id.value-object';
import { createUpdateSpaceNameCommand } from '../../../domain/model/commands/update-space-name.command';
import { createDeleteSpaceCommand } from '../../../domain/model/commands/delete-space.command';
import { createUpdateDeviceNameCommand } from '../../../domain/model/commands/update-device-name.command';
import { createDeleteDeviceCommand } from '../../../domain/model/commands/delete-device.command';
import { createQueueDeviceCommand } from '../../../domain/model/commands/queue-device-command.command';
import { createDeviceCommandType } from '../../../domain/model/valueobjects/device-command-type.value-object';
import { PairDeviceDialogComponent, PairDeviceDialogResult } from '../../components/pair-device-dialog/pair-device-dialog.component';
import { EditNameDialogComponent } from '../../components/edit-name-dialog/edit-name-dialog.component';
import { DeleteSpaceDialogComponent } from '../../components/delete-space-dialog/delete-space-dialog.component';
import { DeleteDeviceDialogComponent, DeleteDeviceDialogData } from '../../components/delete-device-dialog/delete-device-dialog.component';
import { extractApiErrorMessage } from '../../rest/transform/extract-api-error-message.transform';
import { createGetDeviceStatusByIdQuery } from '../../../domain/model/queries/get-device-status-by-id.query';
import { createDeviceId } from '../../../domain/model/valueobjects/device-id.value-object';
import { EditDeviceThresholdsDialogComponent } from '../../components/edit-device-thresholds-dialog/edit-device-thresholds-dialog.component';
import { createGetDeviceThresholdsByDeviceQuery } from '../../../domain/model/queries/get-device-thresholds-by-device.query';

@Injectable({ providedIn: 'root' })
export class SpaceDevicesPageActionsService {
  constructor(
    @Inject(DEVICE_COMMAND_SERVICE) private readonly deviceCommandService: DeviceCommandService,
    @Inject(DEVICE_QUERY_SERVICE) private readonly deviceQueryService: DeviceQueryService,
    @Inject(DEVICE_STATUS_QUERY_SERVICE) private readonly deviceStatusQueryService: DeviceStatusQueryService,
    @Inject(DEVICE_THRESHOLD_QUERY_SERVICE) private readonly deviceThresholdQueryService: DeviceThresholdQueryService,
    private readonly externalTelemetryService: ExternalTelemetryEvaluationService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  loadDevices(spaceId: SpaceId, page: number = 0, size: number = 50): Observable<DevicePage> {
    return this.deviceQueryService.handleGetDevicesBySpace(createGetDevicesBySpaceQuery(spaceId, page, size));
  }

  loadLatestTelemetry(deviceId: string): Observable<DeviceTelemetrySnapshot | null> {
    return this.externalTelemetryService.fetchLatestTelemetryByDevice(deviceId);
  }

  loadDeviceThresholds(deviceId: string): Observable<DeviceThreshold[]> {
    return this.deviceThresholdQueryService.handleGetDeviceThresholdsByDevice(
      createGetDeviceThresholdsByDeviceQuery(createDeviceId(deviceId))
    );
  }

  runEditDeviceThresholdsFlow(deviceId: string): Observable<boolean> {
    const dialogRef = this.dialog.open(EditDeviceThresholdsDialogComponent, {
      panelClass: 'thresholds-dialog-panel',
      width: '980px',
      maxWidth: '96vw',
      maxHeight: '96vh',
      autoFocus: false,
      data: { deviceId },
    });
    return dialogRef.afterClosed().pipe(map((result) => Boolean(result)));
  }

  watchLatestTelemetry(deviceId: string, refreshIntervalMs: number): Observable<DeviceTelemetrySnapshot | null> {
    return interval(refreshIntervalMs).pipe(
      startWith(0),
      switchMap(() => this.loadLatestTelemetry(deviceId)),
      catchError(() => of(null))
    );
  }

  loadLatestTelemetryByDevices(devices: readonly Device[]): Observable<Record<string, DeviceTelemetrySnapshot | null>> {
    if (devices.length === 0) return of({});

    return from(devices).pipe(
      mergeMap(
        (device) =>
          this.loadLatestTelemetry(device.id.value).pipe(
            map((snapshot) => ({ deviceId: device.id.value, snapshot })),
            catchError(() => of({ deviceId: device.id.value, snapshot: null }))
          ),
        6
      ),
      reduce(
        (acc, { deviceId, snapshot }) => {
          acc[deviceId] = snapshot;
          return acc;
        },
        {} as Record<string, DeviceTelemetrySnapshot | null>
      )
    );
  }

  watchLatestTelemetryByDevices(devices: readonly Device[], refreshIntervalMs: number): Observable<Record<string, DeviceTelemetrySnapshot | null>> {
    return interval(refreshIntervalMs).pipe(
      startWith(0),
      switchMap(() => this.loadLatestTelemetryByDevices(devices)),
      catchError(() => of({}))
    );
  }

  watchDeviceStatus(deviceId: string, refreshIntervalMs: number): Observable<DeviceStatusSnapshot | null> {
    return interval(refreshIntervalMs).pipe(
      startWith(0),
      switchMap(() => {
        try {
          const query = createGetDeviceStatusByIdQuery(createDeviceId(deviceId));
          return this.deviceStatusQueryService.handleGetDeviceStatusById(query);
        } catch {
          return of(null);
        }
      }),
      catchError(() => of(null))
    );
  }

  runClaimDeviceFlow(selectedSpace: Space): Observable<void> {
    const dialogRef = this.dialog.open(PairDeviceDialogComponent, { width: '420px' });
    return dialogRef.afterClosed().pipe(
      switchMap((result: PairDeviceDialogResult | undefined) => {
        if (!result) return of(void 0);

        const pairCommand = createPairDeviceCommand(createHardwareId(result.hardwareId));
        return this.deviceCommandService.handlePairDevice(pairCommand).pipe(
          tap({
            error: (error) =>
              this.snackBar.open(extractApiErrorMessage(error, 'Failed to pair sensor'), 'Close', { duration: 3000 }),
          }),
          switchMap((pairing) => {
            const claimToken = pairing.claimToken;
            if (!claimToken) {
              this.snackBar.open('Sensor paired, but no claim token was returned', 'Close', { duration: 3000 });
              return of(void 0);
            }

            const claimCommand = createClaimDeviceCommand(claimToken, selectedSpace.id);
            return this.deviceCommandService.handleClaimDevice(claimCommand).pipe(
              tap({
                next: () => this.snackBar.open('Sensor registered to space', 'Close', { duration: 3000 }),
                error: (error) =>
                  this.snackBar.open(extractApiErrorMessage(error, 'Failed to claim sensor'), 'Close', { duration: 3000 }),
              }),
              switchMap(() => of(void 0))
            );
          })
        );
      })
    );
  }

  runPairDeviceFlow(): Observable<{ claimToken: string | null } | null> {
    const dialogRef = this.dialog.open(PairDeviceDialogComponent, { width: '420px' });
    return dialogRef.afterClosed().pipe(
      switchMap((result: PairDeviceDialogResult | undefined) => {
        if (!result) return of(null);
        const command = createPairDeviceCommand(createHardwareId(result.hardwareId));
        return this.deviceCommandService.handlePairDevice(command).pipe(
          tap({
            next: (pairing) => {
              const claimTokenText = pairing.claimToken ? ` Claim token: ${pairing.claimToken}` : '';
              this.snackBar.open(`Sensor paired.${claimTokenText}`, 'Close', { duration: 6000 });
            },
            error: (error) =>
              this.snackBar.open(extractApiErrorMessage(error, 'Failed to pair sensor'), 'Close', { duration: 3000 }),
          }),
          switchMap((pairing) => of({ claimToken: pairing.claimToken ?? null }))
        );
      })
    );
  }

  runEditSpaceNameFlow(selectedSpace: Space): Observable<string | null> {
    const dialogRef = this.dialog.open(EditNameDialogComponent, {
      width: '400px',
      data: {
        currentValue: selectedSpace.name,
        title: 'Edit Space',
        fieldLabel: 'Space Name',
        placeholder: 'Enter space name',
      },
    });

    return dialogRef.afterClosed().pipe(
      switchMap((name: string | undefined) => {
        if (!name) return of(null);
        const command = createUpdateSpaceNameCommand(selectedSpace.id, name);
        return this.deviceCommandService.handleUpdateSpaceName(command).pipe(
          tap({
            next: () => this.snackBar.open('Space updated', 'Close', { duration: 3000 }),
            error: (error) =>
              this.snackBar.open(extractApiErrorMessage(error, 'Failed to update space'), 'Close', { duration: 3000 }),
          }),
          switchMap(() => of(name))
        );
      })
    );
  }

  runDeleteSpaceFlow(spaceId: SpaceId): Observable<boolean> {
    const dialogRef = this.dialog.open(DeleteSpaceDialogComponent, { width: '400px' });
    return dialogRef.afterClosed().pipe(
      switchMap((confirmed: boolean) => {
        if (!confirmed) return of(false);
        const command = createDeleteSpaceCommand(spaceId);
        return this.deviceCommandService.handleDeleteSpace(command).pipe(
          tap({
            next: () => this.snackBar.open('Space deleted', 'Close', { duration: 3000 }),
            error: (error) =>
              this.snackBar.open(extractApiErrorMessage(error, 'Failed to delete space'), 'Close', { duration: 3000 }),
          }),
          switchMap(() => of(true))
        );
      })
    );
  }

  runEditDeviceNameFlow(selectedDevice: Device): Observable<string | null> {
    const dialogRef = this.dialog.open(EditNameDialogComponent, {
      width: '400px',
      data: {
        currentValue: selectedDevice.name,
        title: 'Edit Device',
        fieldLabel: 'Device Name',
        placeholder: 'Enter device name',
      },
    });

    return dialogRef.afterClosed().pipe(
      switchMap((name: string | undefined) => {
        if (!name) return of(null);
        const command = createUpdateDeviceNameCommand(selectedDevice.id, name);
        return this.deviceCommandService.handleUpdateDeviceName(command).pipe(
          tap({
            next: () => this.snackBar.open('Device updated', 'Close', { duration: 3000 }),
            error: (error) =>
              this.snackBar.open(extractApiErrorMessage(error, 'Failed to update device'), 'Close', { duration: 3000 }),
          }),
          switchMap(() => of(name))
        );
      })
    );
  }

  runDeleteDeviceFlow(selectedDevice: Device): Observable<boolean> {
    const dialogRef = this.dialog.open(DeleteDeviceDialogComponent, {
      width: '400px',
      data: { deviceName: selectedDevice.name } as DeleteDeviceDialogData,
    });

    return dialogRef.afterClosed().pipe(
      switchMap((confirmed: boolean) => {
        if (!confirmed) return of(false);
        const command = createDeleteDeviceCommand(selectedDevice.id);
        return this.deviceCommandService.handleDeleteDevice(command).pipe(
          tap({
            next: () => this.snackBar.open('Device deleted', 'Close', { duration: 3000 }),
            error: (error) =>
              this.snackBar.open(extractApiErrorMessage(error, 'Failed to delete device'), 'Close', { duration: 3000 }),
          }),
          switchMap(() => of(true))
        );
      })
    );
  }

  runToggleDevicePowerFlow(selectedDevice: Device, intent: 'WAKE' | 'STANDBY'): Observable<void> {
    if (selectedDevice.status === 'DECOMMISSIONED') {
      this.snackBar.open('Device is decommissioned and cannot receive commands', 'Close', { duration: 3000 });
      return of(void 0);
    }

    const nextType = createDeviceCommandType(intent);

    const command = createQueueDeviceCommand(selectedDevice.id, nextType);
    return this.deviceCommandService.handleQueueDeviceCommand(command).pipe(
      tap({
        next: (created) => this.snackBar.open(`Command queued: ${created.type}`, 'Close', { duration: 3000 }),
        error: (error) =>
          this.snackBar.open(extractApiErrorMessage(error, 'Failed to queue command'), 'Close', { duration: 3000 }),
      }),
      switchMap(() => of(void 0))
    );
  }
}
