import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, finalize, forkJoin, of } from 'rxjs';

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
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    AIStockAnalysisComponent,
  ],
  templateUrl: './inventory-selection-panel.component.html',
  styleUrl: './inventory-selection-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventorySelectionPanelComponent implements OnInit {
  @ViewChild('inventoryFileInput') private readonly inventoryFileInput?: ElementRef<HTMLInputElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
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
  exportingInventoryByWineCellarId: Record<string, boolean> = {};
  downloadingTemplateByWineCellarId: Record<string, boolean> = {};
  importingInventoryByWineCellarId: Record<string, boolean> = {};
  errorOrganizations = '';
  errorSpacesByOrganizationId: Record<string, string> = {};
  errorWineCellarsBySpaceId: Record<string, string> = {};
  errorInventoryItemsByWineCellarId: Record<string, string> = {};

  selectedOrganization: Organization | null = null;
  selectedSpace: Space | null = null;
  selectedWineCellar: WineCellar | null = null;

  private initialSpaceId: string | null = null;
  private initialWineCellarId: string | null = null;
  private initialSelectionResolved = false;
  private initialSpacesPrefetched = false;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.initialSpaceId = params.get('spaceId');
      this.initialWineCellarId = params.get('wineCellarId');
      this.initialSelectionResolved = false;
      this.initialSpacesPrefetched = false;
      this.tryApplyInitialSelection();
    });

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

  get exportingSelectedWineCellarInventory(): boolean {
    if (!this.selectedWineCellar) return false;
    return !!this.exportingInventoryByWineCellarId[this.selectedWineCellar.id.value];
  }

  get downloadingSelectedWineCellarTemplate(): boolean {
    if (!this.selectedWineCellar) return false;
    return !!this.downloadingTemplateByWineCellarId[this.selectedWineCellar.id.value];
  }

  get importingSelectedWineCellarInventory(): boolean {
    if (!this.selectedWineCellar) return false;
    return !!this.importingInventoryByWineCellarId[this.selectedWineCellar.id.value];
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

  openEditWineDialog(item: WineInventoryItem): void {
    if (!this.selectedWineCellar) return;

    const dialogRef = this.dialog.open(AddWineInventoryItemDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: {
        title: 'Edit wine in inventory',
        submitLabel: 'Save changes',
        initialValue: {
          wineName: item.wineName,
          wineType: item.wineType,
          ageYears: item.ageYears,
          quantity: item.quantity,
        },
      },
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((payload) => {
      if (!payload || !this.selectedWineCellar) return;

      const wineCellarId = this.selectedWineCellar.id.value;
      this.wineInventoryItemCommandService
        .updateInventoryItem(wineCellarId, item.id.value, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updatedItem) => {
            const currentItems = this.inventoryItemsByWineCellarId[wineCellarId] ?? [];
            this.inventoryItemsByWineCellarId = {
              ...this.inventoryItemsByWineCellarId,
              [wineCellarId]: currentItems.map((currentItem) =>
                currentItem.id.value === updatedItem.id.value ? updatedItem : currentItem
              ),
            };
            this.snackBar.open('Wine updated', 'Close', { duration: 3000 });
            this.cdr.markForCheck();
          },
          error: (error: unknown) => {
            this.snackBar.open(extractApiErrorMessage(error, 'No se pudo actualizar el vino'), 'Close', { duration: 3500 });
          },
        });
    });
  }

  deleteWineInventoryItem(item: WineInventoryItem): void {
    if (!this.selectedWineCellar) return;
    if (!window.confirm(`Delete "${item.wineName}" from inventory?`)) return;

    const wineCellarId = this.selectedWineCellar.id.value;
    this.wineInventoryItemCommandService
      .deleteInventoryItem(wineCellarId, item.id.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const currentItems = this.inventoryItemsByWineCellarId[wineCellarId] ?? [];
          this.inventoryItemsByWineCellarId = {
            ...this.inventoryItemsByWineCellarId,
            [wineCellarId]: currentItems.filter((currentItem) => currentItem.id.value !== item.id.value),
          };
          this.snackBar.open('Wine deleted', 'Close', { duration: 3000 });
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiErrorMessage(error, 'No se pudo eliminar el vino'), 'Close', { duration: 3500 });
        },
      });
  }

  downloadInventory(): void {
    if (!this.selectedWineCellar) return;

    const wineCellarId = this.selectedWineCellar.id.value;
    this.exportingInventoryByWineCellarId = { ...this.exportingInventoryByWineCellarId, [wineCellarId]: true };
    this.cdr.markForCheck();

    this.wineInventoryItemCommandService
      .getInventoryExport(wineCellarId)
      .pipe(
        catchError((error: unknown) => {
          this.snackBar.open(extractApiErrorMessage(error, 'No se pudo descargar el inventario'), 'Close', { duration: 3500 });
          return of(null as HttpResponse<Blob> | null);
        }),
        finalize(() => {
          this.exportingInventoryByWineCellarId = { ...this.exportingInventoryByWineCellarId, [wineCellarId]: false };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        if (!response?.body) return;
        this.downloadBlobResponse(response, `wine-cellar-${wineCellarId}-inventory.xlsx`);
        this.snackBar.open('Inventory downloaded', 'Close', { duration: 2500 });
      });
  }

  downloadInventoryTemplate(): void {
    if (!this.selectedWineCellar) return;

    const wineCellarId = this.selectedWineCellar.id.value;
    this.downloadingTemplateByWineCellarId = { ...this.downloadingTemplateByWineCellarId, [wineCellarId]: true };
    this.cdr.markForCheck();

    this.wineInventoryItemCommandService
      .getInventoryTemplate(wineCellarId)
      .pipe(
        catchError((error: unknown) => {
          this.snackBar.open(extractApiErrorMessage(error, 'No se pudo descargar la plantilla'), 'Close', { duration: 3500 });
          return of(null as HttpResponse<Blob> | null);
        }),
        finalize(() => {
          this.downloadingTemplateByWineCellarId = { ...this.downloadingTemplateByWineCellarId, [wineCellarId]: false };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        if (!response?.body) return;
        this.downloadBlobResponse(response, `wine-cellar-${wineCellarId}-inventory-template.xlsx`);
        this.snackBar.open('Template downloaded', 'Close', { duration: 2500 });
      });
  }

  triggerInventoryImport(): void {
    if (!this.selectedWineCellar || !this.inventoryFileInput) return;

    this.inventoryFileInput.nativeElement.value = '';
    this.inventoryFileInput.nativeElement.click();
  }

  onInventoryFileSelected(event: Event): void {
    if (!this.selectedWineCellar) return;

    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (input) {
      input.value = '';
    }

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.snackBar.open('Please select a .xlsx file', 'Close', { duration: 3000 });
      return;
    }

    const wineCellarId = this.selectedWineCellar.id.value;
    this.importingInventoryByWineCellarId = { ...this.importingInventoryByWineCellarId, [wineCellarId]: true };
    this.cdr.markForCheck();

    this.wineInventoryItemCommandService
      .importInventory(wineCellarId, file)
      .pipe(
        catchError((error: unknown) => {
          this.snackBar.open(extractApiErrorMessage(error, 'No se pudo importar el inventario'), 'Close', { duration: 4000 });
          return of(null);
        }),
        finalize(() => {
          this.importingInventoryByWineCellarId = { ...this.importingInventoryByWineCellarId, [wineCellarId]: false };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        if (!result) return;

        this.snackBar.open(`Import completed: ${result.created} created, ${result.updated} updated`, 'Close', {
          duration: 4000,
        });
        this.loadInventoryItems(wineCellarId);
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
        if (this.hasInitialSelectionTarget) {
          this.prefetchSpacesForInitialSelection();
        } else {
          this.tryApplyInitialSelection();
        }
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
        this.tryApplyInitialSelection();
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
        this.tryApplyInitialSelection();
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

  private downloadBlobResponse(response: HttpResponse<Blob>, fallbackFilename: string): void {
    const blob = response.body;
    if (!blob) return;

    const filename = this.extractFilename(response.headers.get('content-disposition')) ?? fallbackFilename;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private extractFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;

    const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    if (!filenameMatch?.[1]) return null;

    return decodeURIComponent(filenameMatch[1].replace(/"/g, '').trim());
  }

  private get hasInitialSelectionTarget(): boolean {
    return !!this.initialSpaceId || !!this.initialWineCellarId;
  }

  private prefetchSpacesForInitialSelection(): void {
    if (this.initialSpacesPrefetched || this.organizations.length === 0) return;

    this.initialSpacesPrefetched = true;

    forkJoin(
      this.organizations.map((organization) =>
        this.deviceQueryService
          .handleGetSpacesByOrganization(createGetSpacesByOrganizationQuery(createOrganizationId(organization.id.value)))
          .pipe(catchError(() => of([] as readonly Space[])))
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((spacesGroups) => {
        this.spacesByOrganizationId = spacesGroups.reduce(
          (acc, spaces, index) => ({
            ...acc,
            [this.organizations[index].id.value]: spaces,
          }),
          {} as Record<string, readonly Space[]>
        );
        this.tryApplyInitialSelection();
        this.cdr.markForCheck();
      });
  }

  private tryApplyInitialSelection(): void {
    if (this.initialSelectionResolved || !this.hasInitialSelectionTarget) return;
    if (this.organizations.length === 0) return;

    const targetSpaceId = this.initialSpaceId;
    if (!targetSpaceId) {
      this.initialSelectionResolved = true;
      return;
    }

    const targetSpace = Object.values(this.spacesByOrganizationId)
      .flat()
      .find((space) => space.id.value === targetSpaceId);
    if (!targetSpace) {
      if (!this.initialSpacesPrefetched) {
        this.prefetchSpacesForInitialSelection();
      }
      return;
    }

    const targetOrganization = this.organizations.find((organization) =>
      (this.spacesByOrganizationId[organization.id.value] ?? []).some((space) => space.id.value === targetSpace.id.value)
    );
    if (!targetOrganization) return;

    this.selectedOrganization = targetOrganization;
    this.selectedSpace = targetSpace;
    this.cdr.markForCheck();

    if (!this.wineCellarsBySpaceId[targetSpace.id.value] && !this.loadingWineCellarsBySpaceId[targetSpace.id.value]) {
      this.loadWineCellars(targetSpace.id.value);
      return;
    }

    if (!this.initialWineCellarId) {
      this.initialSelectionResolved = true;
      return;
    }

    const targetWineCellar = this.selectedSpaceWineCellars.find((cellar) => cellar.id.value === this.initialWineCellarId);
    if (!targetWineCellar) return;

    this.selectedWineCellar = targetWineCellar;
    this.initialSelectionResolved = true;

    if (
      !this.inventoryItemsByWineCellarId[targetWineCellar.id.value] &&
      !this.loadingInventoryItemsByWineCellarId[targetWineCellar.id.value]
    ) {
      this.loadInventoryItems(targetWineCellar.id.value);
    }

    this.cdr.markForCheck();
  }
}
