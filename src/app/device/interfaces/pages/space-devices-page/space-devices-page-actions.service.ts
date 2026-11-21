import { NotificationService } from '../../../../core/services/notification/notification';
import { Inject } from '@angular/core';
import { DEVICE_THRESHOLD_QUERY_SERVICE, DeviceThresholdQueryService } from '../../../domain/services/device-threshold-query-service';
import { DEVICE_STATUS_QUERY_SERVICE, DeviceStatusQueryService } from '../../../domain/services/device-status-query-service';
import { DEVICE_QUERY_SERVICE, DeviceQueryService } from '../../../domain/services/device-query-service';
import { DEVICE_COMMAND_SERVICE, DeviceCommandService } from '../../../domain/services/device-command-service';
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, from, of, switchMap, tap, interval, startWith, catchError, map, mergeMap, take, takeUntil } from 'rxjs';
import { reduce } from 'rxjs/operators';
import { ExternalTelemetryEvaluationService, DeviceTelemetrySnapshot } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { Device, DevicePage } from '../../../domain/services/device-query-service';
import { WorkspaceSpace as Space } from '../../../../shared/models/workspace-context';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
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
import { DESTRUCTIVE_DIALOG_CONFIG } from '../../../../shared/components/destructive-confirmation-dialog/destructive-confirmation-dialog';

@Injectable({ providedIn: 'root' })
export class SpaceDevicesPageActionsService {
  constructor(
    @Inject(DEVICE_COMMAND_SERVICE) private readonly deviceCommandService: DeviceCommandService,
    @Inject(DEVICE_QUERY_SERVICE) private readonly deviceQueryService: DeviceQueryService,
    @Inject(DEVICE_STATUS_QUERY_SERVICE) private readonly deviceStatusQueryService: DeviceStatusQueryService,
    @Inject(DEVICE_THRESHOLD_QUERY_SERVICE) private readonly deviceThresholdQueryService: DeviceThresholdQueryService,
    private readonly externalTelemetryService: ExternalTelemetryEvaluationService,
    private readonly dialog: MatDialog,
    private readonly feedback: NotificationService,
    private readonly scope: WorkspaceScopeService
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
      switchMap(() => this.loadLatestTelemetry(deviceId).pipe(catchError(() => of(null))))
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
      switchMap(() => this.loadLatestTelemetryByDevices(devices).pipe(catchError(() => of({}))))
    );
  }

  watchDeviceStatus(deviceId: string, refreshIntervalMs: number): Observable<DeviceStatusSnapshot | null> {
    return interval(refreshIntervalMs).pipe(
      startWith(0),
      switchMap(() => {
        try {
          const query = createGetDeviceStatusByIdQuery(createDeviceId(deviceId));
          return this.deviceStatusQueryService.handleGetDeviceStatusById(query).pipe(catchError(() => of(null)));
        } catch {
          return of(null);
        }
      }),
      catchError(() => of(null))
    );
  }

  runClaimDeviceFlow(selectedSpace: Space): Observable<boolean> {
    const dialogRef = this.dialog.open(PairDeviceDialogComponent, { width: '420px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog' });
    return dialogRef.afterClosed().pipe(
      take(1),
      switchMap((result: PairDeviceDialogResult | undefined) => {
        if (!result) return of(false);

        const pairCommand = createPairDeviceCommand(createHardwareId(result.hardwareId));
        return this.deviceCommandService.handlePairDevice(pairCommand).pipe(
          tap({
            error: (error) =>
              this.feedback.show(extractApiErrorMessage(error, 'Failed to pair sensor'), 'error', 3000),
          }),
          switchMap((pairing) => {
            const claimToken = pairing.claimToken;
            if (!claimToken) {
              this.feedback.show('Sensor paired, but no claim token was returned', 'warning', 3000);
              return of(false);
            }

            const claimCommand = createClaimDeviceCommand(claimToken, selectedSpace.id);
            return this.deviceCommandService.handleClaimDevice(claimCommand).pipe(
              tap({
                next: () => this.feedback.show('Sensor registered to space', 'success', 3000),
                error: (error) =>
                  this.feedback.show(extractApiErrorMessage(error, 'Failed to claim sensor'), 'error', 3000),
              }),
              map(() => true)
            );
          })
        );
      }),
      catchError(() => of(false)),
      // Includes time spent in the modal: never claim into an old space after
      // the user switches workspace/authorization, and never retry mutations.
      takeUntil(this.scope.changed)
    );
  }

  runPairDeviceFlow(): Observable<{ claimToken: string | null } | null> {
    const dialogRef = this.dialog.open(PairDeviceDialogComponent, { width: '420px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog' });
    return dialogRef.afterClosed().pipe(
      switchMap((result: PairDeviceDialogResult | undefined) => {
        if (!result) return of(null);
        const command = createPairDeviceCommand(createHardwareId(result.hardwareId));
        return this.deviceCommandService.handlePairDevice(command).pipe(
          tap({
            next: (pairing) => {
              this.feedback.show(pairing.claimToken ? 'Sensor paired. Claim token: {token}' : 'Sensor paired.', 'success', 6000, { token: pairing.claimToken });
            },
            error: (error) =>
              this.feedback.show(extractApiErrorMessage(error, 'Failed to pair sensor'), 'error', 3000),
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
            next: () => this.feedback.show('Space updated', 'success', 3000),
            error: (error) =>
              this.feedback.show(extractApiErrorMessage(error, 'Failed to update space'), 'error', 3000),
          }),
          switchMap(() => of(name))
        );
      })
    );
  }

  runDeleteSpaceFlow(spaceId: SpaceId): Observable<boolean> {
    const dialogRef = this.dialog.open(DeleteSpaceDialogComponent, DESTRUCTIVE_DIALOG_CONFIG);
    return dialogRef.afterClosed().pipe(
      take(1),
      switchMap((confirmed: boolean) => {
        if (!confirmed) return of(false);
        const command = createDeleteSpaceCommand(spaceId);
        return this.deviceCommandService.handleDeleteSpace(command).pipe(
          tap({
            next: () => this.feedback.show('Space deleted', 'success', 3000),
            error: (error) =>
              this.feedback.show(extractApiErrorMessage(error, 'Failed to delete space'), 'error', 3000),
          }),
          map(() => true),
          catchError(() => of(false))
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
            next: () => this.feedback.show('Device updated', 'success', 3000),
            error: (error) =>
              this.feedback.show(extractApiErrorMessage(error, 'Failed to update device'), 'error', 3000),
          }),
          switchMap(() => of(name))
        );
      })
    );
  }

  runDeleteDeviceFlow(selectedDevice: Device): Observable<boolean> {
    const dialogRef = this.dialog.open(DeleteDeviceDialogComponent, {
      ...DESTRUCTIVE_DIALOG_CONFIG,
      data: { deviceName: selectedDevice.name } as DeleteDeviceDialogData,
    });

    return dialogRef.afterClosed().pipe(
      switchMap((confirmed: boolean) => {
        if (!confirmed) return of(false);
        const command = createDeleteDeviceCommand(selectedDevice.id);
        return this.deviceCommandService.handleDeleteDevice(command).pipe(
          tap({
            next: () => this.feedback.show('Device deleted', 'success', 3000),
            error: (error) =>
              this.feedback.show(extractApiErrorMessage(error, 'Failed to delete device'), 'error', 3000),
          }),
          switchMap(() => of(true))
        );
      })
    );
  }

  runToggleDevicePowerFlow(selectedDevice: Device, intent: 'WAKE' | 'STANDBY'): Observable<void> {
    if (selectedDevice.status === 'DECOMMISSIONED') {
      this.feedback.show('Device is decommissioned and cannot receive commands', 'warning', 3000);
      return of(void 0);
    }

    const nextType = createDeviceCommandType(intent);

    const command = createQueueDeviceCommand(selectedDevice.id, nextType);
    return this.deviceCommandService.handleQueueDeviceCommand(command).pipe(
      tap({
        next: (created) => this.feedback.show('Command queued: {type}', 'success', 3000, { type: created.type }),
        error: (error) =>
          this.feedback.show(extractApiErrorMessage(error, 'Failed to queue command'), 'error', 3000),
      }),
      switchMap(() => of(void 0))
    );
  }
}
