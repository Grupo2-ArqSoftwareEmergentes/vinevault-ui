import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, filter, finalize, forkJoin, interval, map, Observable, of, Subscription, switchMap, startWith, take } from 'rxjs';
import { DESTRUCTIVE_DIALOG_CONFIG, DestructiveConfirmationDialogComponent } from '../../../../shared/components/destructive-confirmation-dialog/destructive-confirmation-dialog';

import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { WineCellarCreationService } from '../../services/wine-cellar-creation.service';
import { CanSpaceDirective } from '../../../../shared/directives/can-space.directive';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { WorkspaceSpace as Space } from '../../../../shared/models/workspace-context';
import { SpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { ManagementBackLinkComponent } from '../../../../shared/components/management-back-link/management-back-link';
import { WineCellarCommandServiceImpl } from '../../../application/internal/commandservices/wine-cellar-command-service.impl';
import { WineCellarQueryServiceImpl } from '../../../application/internal/queryservices/wine-cellar-query-service.impl';
import { SpaceDetailCavaHeaderComponent } from '../../components/space-detail-cava-header/space-detail-cava-header.component';
import { WineCellar } from '../../../domain/services/wine-cellar-query-service';
import {
  WineCellarDialogComponent,
  WineCellarDialogResult,
} from '../../components/wine-cellar-dialog/wine-cellar-dialog.component';
import {
  DeviceTelemetrySnapshot,
  ExternalTelemetryEvaluationService,
} from '../../../../device/application/internal/outboundservices/acl/external-telemetry-evaluation.service';

@Component({
  selector: 'app-cavas-page',
  standalone: true,
  providers: [WineCellarCreationService],
  imports: [
    CanSpaceDirective,
    CommonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    HeaderComponent,
    SidebarComponent,
    ManagementBackLinkComponent,
    SpaceDetailCavaHeaderComponent,
  ],
  templateUrl: './cavas-page.component.html',
  styleUrl: './cavas-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CavasPageComponent implements OnInit, OnDestroy {
  private readonly cellarCreation = inject(WineCellarCreationService);
  readonly access = inject(WorkspaceAccessService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly wineCellarQueryService = inject(WineCellarQueryServiceImpl);
  private readonly wineCellarCommandService = inject(WineCellarCommandServiceImpl);
  private readonly telemetryService = inject(ExternalTelemetryEvaluationService);
  private readonly workspace = inject(WorkspaceContextService);
  private cellarLoadSubscription: Subscription | null = null;

  isSidebarOpen = window.innerWidth > 768;
  selectedSpace: Space | null = null;
  loadingWineCellars = false;
  errorWineCellars = '';
  wineCellars: readonly WineCellar[] = [];
  selectedWineCellarId: string | null = null;
  linkedDeviceTelemetryById: Record<string, DeviceTelemetrySnapshot | null> = {};
  private telemetryPollingSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.workspace.selectionChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ space, cellar }) => {
      if (!space) this.clearSelectedSpace();
      else if (this.selectedSpace?.id.value !== space.id.value) this.selectSpace(space);
      else {
        this.selectedSpace = space;
        if (!this.loadingWineCellars && cellar && !this.wineCellars.some((item) => item.id.value === cellar.id.value)) this.loadWineCellars(space.id);
      }
      this.selectedWineCellarId = cellar?.id.value ?? null;
      this.cdr.markForCheck();
    });
    this.workspace.ensureLoaded();
  }

  ngOnDestroy(): void {
    this.cellarLoadSubscription?.unsubscribe();
    this.stopTelemetryPolling();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  selectSpace(space: Space): void {
    this.stopTelemetryPolling();
    this.linkedDeviceTelemetryById = {};
    this.selectedSpace = space;
    this.selectedWineCellarId = null;
    this.loadWineCellars(space.id);
    this.cdr.markForCheck();
  }

  clearSelectedSpace(): void {
    this.cellarLoadSubscription?.unsubscribe();
    this.selectedSpace = null;
    this.selectedWineCellarId = null;
    this.wineCellars = [];
    this.errorWineCellars = '';
    this.linkedDeviceTelemetryById = {};
    this.stopTelemetryPolling();
    this.cdr.markForCheck();
  }

  openCreateWineCellarDialog(): void {
    if (!this.selectedSpace || !this.access.canConfigure()) return;

    const spaceId = this.selectedSpace.id.value;
    this.cellarCreation.open(spaceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((created) => {
      if (this.selectedSpace?.id.value !== spaceId) return;
      this.selectedWineCellarId = created.id.value;
      this.reloadSelectedSpaceData();
    });
  }

  openEditWineCellarDialog(wineCellar: WineCellar): void {
    if (!this.selectedSpace || !this.access.canConfigure()) return;

    const dialogRef = this.dialog.open(WineCellarDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      panelClass: 'cava-management-dialog',
      data: {
        title: 'Editar cava',
        submitLabel: 'Guardar',
        spaceId: this.selectedSpace.id.value,
        name: wineCellar.name,
        description: wineCellar.description,
        currentDeviceId: wineCellar.deviceId?.value ?? null,
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: WineCellarDialogResult | undefined) => {
        if (!result) return;

        this.wineCellarCommandService
          .updateWineCellar(wineCellar.id.value, result)
          .pipe(
            switchMap((updatedCellar) =>
              this.syncWineCellarDevice(updatedCellar.id.value, wineCellar.deviceId?.value ?? null, result.deviceId).pipe(
                map(() => updatedCellar)
              )
            ),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe({
            next: (updatedCellar) => {
              this.workspace.upsertCellar(updatedCellar, false, true);
              this.selectedWineCellarId = updatedCellar.id.value;
              this.snackBar.open('Cava actualizada', 'Close', { duration: 3000 });
              this.reloadSelectedSpaceData();
            },
            error: (error: unknown) => {
              this.snackBar.open(
                extractApiErrorMessage(error, 'No se pudo actualizar la cava'),
                'Close',
                { duration: 3500 }
              );
            },
          });
      });
  }

  deleteWineCellar(wineCellar: WineCellar): void {
    if (!this.access.canConfigure()) return;
    this.dialog.open(DestructiveConfirmationDialogComponent, {
      ...DESTRUCTIVE_DIALOG_CONFIG,
      data: { title: 'Eliminar cava', description: `¿Eliminar la cava "${wineCellar.name}"? Esta acción no se puede deshacer.` },
    }).afterClosed().pipe(
      take(1),
      filter((confirmed) => confirmed === true),
      switchMap(() => this.wineCellarCommandService.deleteWineCellar(wineCellar.id.value)),
      takeUntilDestroyed(this.destroyRef)
    )
      .subscribe({
        next: () => {
          this.workspace.removeCellar(wineCellar.id.value);
          if (this.selectedWineCellarId === wineCellar.id.value) {
            this.selectedWineCellarId = null;
          }
          this.snackBar.open('Cava eliminada', 'Close', { duration: 3000 });
          this.reloadSelectedSpaceData();
        },
        error: (error: unknown) => {
          this.snackBar.open(
            extractApiErrorMessage(error, 'No se pudo eliminar la cava'),
            'Close',
            { duration: 3500 }
          );
        },
      });
  }

  openInventoryForWineCellar(wineCellar: WineCellar): void {
    if (!this.selectedSpace) return;
    void this.router.navigate(['/inventory'], {
      queryParams: {
        spaceId: this.selectedSpace.id.value,
        wineCellarId: wineCellar.id.value,
      },
    });
  }

  selectWineCellar(wineCellar: WineCellar): void {
    this.selectedWineCellarId = this.selectedWineCellarId === wineCellar.id.value ? null : wineCellar.id.value;
    if (this.selectedWineCellarId) this.workspace.upsertCellar(wineCellar, true);
    else if (this.selectedSpace) this.workspace.chooseSpace(this.selectedSpace.id.value);
    this.cdr.markForCheck();
  }

  trackByCellarId(_index: number, cellar: WineCellar): string {
    return cellar.id.value;
  }

  linkedDeviceName(wineCellar: WineCellar): string {
    return wineCellar.deviceId ? 'Vinculado' : 'No vinculado';
  }

  linkedDeviceTelemetry(wineCellar: WineCellar): DeviceTelemetrySnapshot | null {
    const deviceId = wineCellar.deviceId?.value;
    if (!deviceId) return null;
    return this.linkedDeviceTelemetryById[deviceId] ?? null;
  }

  linkedDeviceMetricsLabel(wineCellar: WineCellar): string {
    const telemetry = this.linkedDeviceTelemetry(wineCellar);
    if (!wineCellar.deviceId) return 'No vinculado';
    if (!telemetry) return 'Sin telemetría';

    const temp = telemetry.temperature != null ? `${telemetry.temperature.toFixed(1)} °C` : '--';
    const humidity = telemetry.humidity != null ? `${telemetry.humidity.toFixed(1)} %` : '--';
    return `Temp ${temp} | Humedad ${humidity}`;
  }

  private loadWineCellars(spaceId: SpaceId): void {
    this.cellarLoadSubscription?.unsubscribe();
    this.loadingWineCellars = true;
    this.errorWineCellars = '';
    this.wineCellars = [];
    this.cdr.markForCheck();

    this.cellarLoadSubscription = this.wineCellarQueryService
      .getWineCellarsBySpace(spaceId.value)
      .pipe(
        catchError((error) => {
          this.errorWineCellars = extractApiErrorMessage(error, 'No se pudieron cargar las cavas');
          return of([] as readonly WineCellar[]);
        }),
        finalize(() => {
          this.loadingWineCellars = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((wineCellars) => {
        this.wineCellars = wineCellars;
        this.workspace.updateCellars(spaceId.value, wineCellars);
        if (this.selectedWineCellarId && !wineCellars.some((cellar) => cellar.id.value === this.selectedWineCellarId)) {
          this.selectedWineCellarId = null;
        }
        this.startTelemetryPolling(wineCellars);
        this.cdr.markForCheck();
      });
  }

  private reloadSelectedSpaceData(): void {
    if (!this.selectedSpace) return;
    this.loadWineCellars(this.selectedSpace.id);
  }

  private startTelemetryPolling(wineCellars: readonly WineCellar[]): void {
    this.stopTelemetryPolling();

    const linkedDevices = wineCellars.filter((cellar) => cellar.deviceId).map((cellar) => cellar.deviceId!.value);
    if (linkedDevices.length === 0) {
      this.linkedDeviceTelemetryById = {};
      return;
    }

    this.telemetryPollingSubscription = interval(10_000)
      .pipe(
        startWith(0),
        switchMap(() => this.loadTelemetryByDeviceIds(linkedDevices))
      )
      .subscribe({
        next: (telemetryById) => {
          this.linkedDeviceTelemetryById = telemetryById;
          this.cdr.markForCheck();
        },
        error: () => {
          this.linkedDeviceTelemetryById = {};
          this.cdr.markForCheck();
        },
      });
  }

  private stopTelemetryPolling(): void {
    if (!this.telemetryPollingSubscription) return;
    this.telemetryPollingSubscription.unsubscribe();
    this.telemetryPollingSubscription = null;
  }

  private loadTelemetryByDeviceIds(deviceIds: readonly string[]): Observable<Record<string, DeviceTelemetrySnapshot | null>> {
    if (deviceIds.length === 0) return of({});

    return forkJoin(
      deviceIds.map((deviceId) =>
        this.telemetryService.fetchLatestTelemetryByDevice(deviceId).pipe(
          map((snapshot) => ({ deviceId, snapshot })),
          catchError(() => of({ deviceId, snapshot: null }))
        )
      )
    ).pipe(
      map((entries) =>
        entries.reduce(
          (acc, entry) => {
            acc[entry.deviceId] = entry.snapshot;
            return acc;
          },
          {} as Record<string, DeviceTelemetrySnapshot | null>
        )
      )
    );
  }

  private syncWineCellarDevice(
    wineCellarId: string,
    currentDeviceId: string | null,
    nextDeviceId: string | null
  ): Observable<void> {
    if (currentDeviceId === nextDeviceId) return of(void 0);

    const unlink$ = currentDeviceId
      ? this.wineCellarCommandService.unlinkDevice(wineCellarId, currentDeviceId).pipe(map(() => void 0))
      : of(void 0);

    return unlink$.pipe(
      switchMap(() =>
        nextDeviceId
          ? this.wineCellarCommandService.linkDevice(wineCellarId, nextDeviceId).pipe(map(() => void 0))
          : of(void 0)
      )
    );
  }
}
