import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, Observable, of, switchMap } from 'rxjs';

import { OrganizationsPanelComponent } from '../../../../device/interfaces/components/organizations-panel/organizations-panel.component';
import { Space } from '../../../../device/domain/services/device-query-service';
import { SpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { WineCellarCommandServiceImpl } from '../../../application/internal/commandservices/wine-cellar-command-service.impl';
import { WineCellarQueryServiceImpl } from '../../../application/internal/queryservices/wine-cellar-query-service.impl';
import { SpaceDetailCavaHeaderComponent } from '../../components/space-detail-cava-header/space-detail-cava-header.component';
import { WineCellar } from '../../../domain/services/wine-cellar-query-service';
import {
  WineCellarDialogComponent,
  WineCellarDialogResult,
} from '../../components/wine-cellar-dialog/wine-cellar-dialog.component';

@Component({
  selector: 'app-cavas-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    HeaderComponent,
    SidebarComponent,
    OrganizationsPanelComponent,
    SpaceDetailCavaHeaderComponent,
  ],
  templateUrl: './cavas-page.component.html',
  styleUrl: './cavas-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CavasPageComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly wineCellarQueryService = inject(WineCellarQueryServiceImpl);
  private readonly wineCellarCommandService = inject(WineCellarCommandServiceImpl);

  isSidebarOpen = true;
  isOrganizationsDrawerOpen = false;
  selectedSpace: Space | null = null;
  loadingWineCellars = false;
  errorWineCellars = '';
  wineCellars: readonly WineCellar[] = [];
  selectedWineCellarId: string | null = null;

  ngOnInit(): void {}

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  openOrganizationsDrawer(): void {
    this.isOrganizationsDrawerOpen = true;
  }

  closeOrganizationsDrawer(): void {
    this.isOrganizationsDrawerOpen = false;
  }

  selectSpace(space: Space): void {
    this.closeOrganizationsDrawer();
    this.selectedSpace = space;
    this.selectedWineCellarId = null;
    this.loadWineCellars(space.id);
    this.cdr.markForCheck();
  }

  clearSelectedSpace(): void {
    this.selectedSpace = null;
    this.selectedWineCellarId = null;
    this.wineCellars = [];
    this.errorWineCellars = '';
    this.cdr.markForCheck();
  }

  openCreateWineCellarDialog(): void {
    if (!this.selectedSpace) return;

    const dialogRef = this.dialog.open(WineCellarDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        title: 'Crear cava',
        submitLabel: 'Crear',
        spaceId: this.selectedSpace.id.value,
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: WineCellarDialogResult | undefined) => {
        if (!result || !this.selectedSpace) return;

        this.wineCellarCommandService
          .createWineCellar(this.selectedSpace.id.value, result)
          .pipe(
            switchMap((createdCellar) =>
              this.syncWineCellarDevice(createdCellar.id.value, null, result.deviceId).pipe(map(() => createdCellar))
            ),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe({
            next: (createdCellar) => {
              this.selectedWineCellarId = createdCellar.id.value;
              this.snackBar.open('Cava creada', 'Close', { duration: 3000 });
              this.reloadSelectedSpaceData();
            },
            error: (error: unknown) => {
              this.snackBar.open(extractApiErrorMessage(error, 'No se pudo crear la cava'), 'Close', { duration: 3500 });
            },
          });
      });
  }

  openEditWineCellarDialog(wineCellar: WineCellar): void {
    if (!this.selectedSpace) return;

    const dialogRef = this.dialog.open(WineCellarDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
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
    if (!window.confirm(`Eliminar la cava "${wineCellar.name}"?`)) return;

    this.wineCellarCommandService
      .deleteWineCellar(wineCellar.id.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
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

  selectWineCellar(wineCellar: WineCellar): void {
    this.selectedWineCellarId = this.selectedWineCellarId === wineCellar.id.value ? null : wineCellar.id.value;
    this.cdr.markForCheck();
  }

  trackByCellarId(_index: number, cellar: WineCellar): string {
    return cellar.id.value;
  }

  linkedDeviceName(wineCellar: WineCellar): string {
    return wineCellar.deviceId ? 'Vinculada' : 'Sin dispositivo';
  }

  private loadWineCellars(spaceId: SpaceId): void {
    this.loadingWineCellars = true;
    this.errorWineCellars = '';
    this.wineCellars = [];
    this.cdr.markForCheck();

    this.wineCellarQueryService
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
        if (this.selectedWineCellarId && !wineCellars.some((cellar) => cellar.id.value === this.selectedWineCellarId)) {
          this.selectedWineCellarId = null;
        }
        this.cdr.markForCheck();
      });
  }

  private reloadSelectedSpaceData(): void {
    if (!this.selectedSpace) return;
    this.loadWineCellars(this.selectedSpace.id);
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
