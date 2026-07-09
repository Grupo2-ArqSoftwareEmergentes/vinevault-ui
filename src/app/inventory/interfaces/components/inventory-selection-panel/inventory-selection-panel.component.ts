import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, finalize, of } from 'rxjs';

import {
  DEVICE_QUERY_SERVICE,
  DeviceQueryService,
  Organization,
  Space,
} from '../../../../device/domain/services/device-query-service';
import { createGetCurrentUserOrganizationsQuery } from '../../../../device/domain/model/queries/get-current-user-organizations.query';
import { createGetSpacesByOrganizationQuery } from '../../../../device/domain/model/queries/get-spaces-by-organization.query';
import { createOrganizationId } from '../../../../device/domain/model/valueobjects/organization-id.value-object';
import { WineCellar, WineCellarQueryService } from '../../../../cava/domain/services/wine-cellar-query-service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import {
  WineInventoryItem,
  WineInventoryItemQueryService,
} from '../../../domain/services/wine-inventory-item-query-service';
import { AddWineInventoryItemDialogComponent } from '../add-wine-inventory-item-dialog/add-wine-inventory-item-dialog.component';
import { WineInventoryItemCommandService } from '../../../domain/services/wine-inventory-item-command-service';
import { WineInventoryItemQueryServiceImpl } from '../../../application/internal/queryservices/wine-inventory-item-query-service.impl';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { AIStockAnalysisComponent } from '../../../../invetory_intelligence/interfaces/components/ai-stock-analysis/ai-stock-analysis.component';

@Component({
  selector: 'app-inventory-selection-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    AIStockAnalysisComponent,
  ],
  templateUrl: './inventory-selection-panel.component.html',
  styleUrl: './inventory-selection-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventorySelectionPanelComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly deviceQueryService = inject(DEVICE_QUERY_SERVICE) as DeviceQueryService;
  private readonly wineCellarQueryService = inject(WineCellarQueryServiceImpl) as WineCellarQueryService;
  private readonly wineInventoryItemQueryService = inject(WineInventoryItemQueryServiceImpl) as WineInventoryItemQueryService;
  private readonly wineInventoryItemCommandService = inject(WineInventoryItemCommandServiceImpl) as WineInventoryItemCommandService;

  organizations: readonly Organization[] = [];
  spacesByOrganizationId: Record<string, readonly Space[]> = {};
  wineCellarsBySpaceId: Record<string, readonly WineCellar[]> = {};
  inventoryItemsByWineCellarId: Record<string, readonly WineInventoryItem[]> = {};
  loadingOrganizations = false;
  loadingSpacesByOrganizationId: Record<string, boolean> = {};
  loadingWineCellarsBySpaceId: Record<string, boolean> = {};
  loadingInventoryItemsByWineCellarId: Record<string, boolean> = {};
  errorOrganizations = '';
  errorSpacesByOrganizationId: Record<string, string> = {};
  errorWineCellarsBySpaceId: Record<string, string> = {};
  errorInventoryItemsByWineCellarId: Record<string, string> = {};

  selectedOrganization: Organization | null = null;
  selectedSpace: Space | null = null;
  selectedWineCellar: WineCellar | null = null;

  ngOnInit(): void {
    this.loadOrganizations();
  }

  get selectedOrganizationSpaces(): readonly Space[] {
    if (!this.selectedOrganization) return [];
    return this.spacesByOrganizationId[this.selectedOrganization.id.value] ?? [];
  }

  get selectedSpaceWineCellars(): readonly WineCellar[] {
    if (!this.selectedSpace) return [];
    return this.wineCellarsBySpaceId[this.selectedSpace.id.value] ?? [];
  }

  get loadingSelectedOrganizationSpaces(): boolean {
    if (!this.selectedOrganization) return false;
    return !!this.loadingSpacesByOrganizationId[this.selectedOrganization.id.value];
  }

  get loadingSelectedSpaceWineCellars(): boolean {
    if (!this.selectedSpace) return false;
    return !!this.loadingWineCellarsBySpaceId[this.selectedSpace.id.value];
  }

  get selectedWineCellarInventoryItems(): readonly WineInventoryItem[] {
    if (!this.selectedWineCellar) return [];
    return this.inventoryItemsByWineCellarId[this.selectedWineCellar.id.value] ?? [];
  }

  get loadingSelectedWineCellarInventoryItems(): boolean {
    if (!this.selectedWineCellar) return false;
    return !!this.loadingInventoryItemsByWineCellarId[this.selectedWineCellar.id.value];
  }

  selectOrganization(organizationId: string): void {
    const organization = this.organizations.find((currentOrganization) => currentOrganization.id.value === organizationId) ?? null;
    this.selectedOrganization = organization;
    this.selectedSpace = null;
    this.selectedWineCellar = null;
    this.cdr.markForCheck();

    if (!organization) return;

    if (!this.spacesByOrganizationId[organizationId] && !this.loadingSpacesByOrganizationId[organizationId]) {
      this.loadSpaces(organization.id.value);
    }
  }

  selectSpace(spaceId: string): void {
    const space = this.selectedOrganizationSpaces.find((currentSpace) => currentSpace.id.value === spaceId) ?? null;
    this.selectedSpace = space;
    this.selectedWineCellar = null;
    this.cdr.markForCheck();

    if (!space) return;

    if (!this.wineCellarsBySpaceId[spaceId] && !this.loadingWineCellarsBySpaceId[spaceId]) {
      this.loadWineCellars(spaceId);
    }
  }

  selectWineCellar(wineCellarId: string): void {
    this.selectedWineCellar = this.selectedSpaceWineCellars.find((cellar) => cellar.id.value === wineCellarId) ?? null;
    this.cdr.markForCheck();

    if (!this.selectedWineCellar) return;

    if (
      !this.inventoryItemsByWineCellarId[wineCellarId] &&
      !this.loadingInventoryItemsByWineCellarId[wineCellarId]
    ) {
      this.loadInventoryItems(wineCellarId);
    }
  }

  openAddWineDialog(): void {
    if (!this.selectedWineCellar) return;

    const dialogRef = this.dialog.open(AddWineInventoryItemDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: {
        title: 'Add wine to inventory',
        submitLabel: 'Add wine',
      },
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      if (!payload || !this.selectedWineCellar) return;

      this.wineInventoryItemCommandService
        .createInventoryItem(this.selectedWineCellar.id.value, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (createdItem) => {
            const cellarId = this.selectedWineCellar?.id.value;
            if (cellarId) {
              const currentItems = this.inventoryItemsByWineCellarId[cellarId] ?? [];
              this.inventoryItemsByWineCellarId = {
                ...this.inventoryItemsByWineCellarId,
                [cellarId]: [...currentItems, createdItem],
              };
            }
            this.snackBar.open('Wine added', 'Close', { duration: 3000 });
            this.cdr.markForCheck();
          },
          error: (error: unknown) => {
            this.snackBar.open(extractApiErrorMessage(error, 'No se pudo agregar el vino'), 'Close', { duration: 3500 });
          },
        });
    });
  }

  trackByOrganizationId(_index: number, organization: Organization): string {
    return organization.id.value;
  }

  trackBySpaceId(_index: number, space: Space): string {
    return space.id.value;
  }

  trackByWineCellarId(_index: number, cellar: WineCellar): string {
    return cellar.id.value;
  }

  trackByWineInventoryItemId(_index: number, item: WineInventoryItem): string {
    return item.id.value;
  }

  get canAddWine(): boolean {
    return !!this.selectedWineCellar;
  }

  private loadOrganizations(): void {
    if (this.loadingOrganizations) return;
    this.loadingOrganizations = true;
    this.errorOrganizations = '';
    this.cdr.markForCheck();

    this.deviceQueryService
      .handleGetCurrentUserOrganizations(createGetCurrentUserOrganizationsQuery())
      .pipe(
        catchError((error: unknown) => {
          this.errorOrganizations = error instanceof Error ? error.message : 'No se pudieron cargar las organizaciones';
          this.cdr.markForCheck();
          return of([] as readonly Organization[]);
        }),
        finalize(() => {
          this.loadingOrganizations = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((organizations) => {
        this.organizations = organizations;
        this.cdr.markForCheck();
      });
  }

  private loadSpaces(organizationId: string): void {
    this.loadingSpacesByOrganizationId = { ...this.loadingSpacesByOrganizationId, [organizationId]: true };
    this.errorSpacesByOrganizationId = { ...this.errorSpacesByOrganizationId, [organizationId]: '' };
    this.cdr.markForCheck();

    this.deviceQueryService
      .handleGetSpacesByOrganization(createGetSpacesByOrganizationQuery(createOrganizationId(organizationId)))
      .pipe(
        catchError((error: unknown) => {
          this.errorSpacesByOrganizationId = {
            ...this.errorSpacesByOrganizationId,
            [organizationId]: error instanceof Error ? error.message : 'No se pudieron cargar los espacios',
          };
          this.cdr.markForCheck();
          return of([] as readonly Space[]);
        }),
        finalize(() => {
          this.loadingSpacesByOrganizationId = { ...this.loadingSpacesByOrganizationId, [organizationId]: false };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((spaces) => {
        this.spacesByOrganizationId = { ...this.spacesByOrganizationId, [organizationId]: spaces };
        this.cdr.markForCheck();
      });
  }

  private loadWineCellars(spaceId: string): void {
    this.loadingWineCellarsBySpaceId = { ...this.loadingWineCellarsBySpaceId, [spaceId]: true };
    this.errorWineCellarsBySpaceId = { ...this.errorWineCellarsBySpaceId, [spaceId]: '' };
    this.cdr.markForCheck();

    this.wineCellarQueryService
      .getWineCellarsBySpace(spaceId)
      .pipe(
        catchError((error: unknown) => {
          this.errorWineCellarsBySpaceId = {
            ...this.errorWineCellarsBySpaceId,
            [spaceId]: error instanceof Error ? error.message : 'No se pudieron cargar las cavas',
          };
          this.cdr.markForCheck();
          return of([] as readonly WineCellar[]);
        }),
        finalize(() => {
          this.loadingWineCellarsBySpaceId = { ...this.loadingWineCellarsBySpaceId, [spaceId]: false };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((wineCellars) => {
        this.wineCellarsBySpaceId = { ...this.wineCellarsBySpaceId, [spaceId]: wineCellars };
        this.cdr.markForCheck();
      });
  }

  private loadInventoryItems(wineCellarId: string): void {
    this.loadingInventoryItemsByWineCellarId = { ...this.loadingInventoryItemsByWineCellarId, [wineCellarId]: true };
    this.errorInventoryItemsByWineCellarId = { ...this.errorInventoryItemsByWineCellarId, [wineCellarId]: '' };
    this.cdr.markForCheck();

    this.wineInventoryItemQueryService
      .getInventoryItemsByWineCellar(wineCellarId)
      .pipe(
        catchError((error: unknown) => {
          this.errorInventoryItemsByWineCellarId = {
            ...this.errorInventoryItemsByWineCellarId,
            [wineCellarId]: error instanceof Error ? error.message : 'No se pudieron cargar los items de inventario',
          };
          this.cdr.markForCheck();
          return of([] as readonly WineInventoryItem[]);
        }),
        finalize(() => {
          this.loadingInventoryItemsByWineCellarId = {
            ...this.loadingInventoryItemsByWineCellarId,
            [wineCellarId]: false,
          };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((inventoryItems) => {
        this.inventoryItemsByWineCellarId = { ...this.inventoryItemsByWineCellarId, [wineCellarId]: inventoryItems };
        this.cdr.markForCheck();
      });
  }
}
