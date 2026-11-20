import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, filter, finalize, of, switchMap, take } from 'rxjs';
import { DESTRUCTIVE_DIALOG_CONFIG, DestructiveConfirmationDialogComponent } from '../../../../shared/components/destructive-confirmation-dialog/destructive-confirmation-dialog';

import { WorkspaceCellar, WorkspaceSpace } from '../../../../shared/models/workspace-context';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { CanSpaceDirective } from '../../../../shared/directives/can-space.directive';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import {
  WineInventoryItem,
  WineInventoryItemQueryService,
} from '../../../domain/services/wine-inventory-item-query-service';
import { WineInventoryItemCommandService } from '../../../domain/services/wine-inventory-item-command-service';
import { WineInventoryItemQueryServiceImpl } from '../../../application/internal/queryservices/wine-inventory-item-query-service.impl';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { StockMovementDialogComponent } from '../stock-movement-dialog/stock-movement-dialog';
import { StockMovement } from '../../../domain/model/stock-movement';
import { inventoryQuotaProjection } from '../../../../shared/services/workspace-quota';
import { SpaceQuotaDialogComponent } from '../../../../shared/components/space-quota-dialog/space-quota-dialog';
import { InventoryExportDialogComponent } from '../inventory-export-dialog/inventory-export-dialog';
import { InventoryImportDialogComponent } from '../inventory-import-dialog/inventory-import-dialog';

@Component({
  selector: 'app-inventory-selection-panel',
  standalone: true,
  imports: [
    CanSpaceDirective,
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './inventory-selection-panel.component.html',
  styleUrl: './inventory-selection-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventorySelectionPanelComponent implements OnInit {
  @ViewChild(MatMenuTrigger) private readonly optionsTrigger?: MatMenuTrigger;

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly workspace = inject(WorkspaceContextService);
  readonly access = inject(WorkspaceAccessService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly wineInventoryItemQueryService = inject(WineInventoryItemQueryServiceImpl) as WineInventoryItemQueryService;
  private readonly wineInventoryItemCommandService = inject(WineInventoryItemCommandServiceImpl) as WineInventoryItemCommandService;

  inventoryItemsByWineCellarId: Record<string, readonly WineInventoryItem[]> = {};
  loadingInventoryItemsByWineCellarId: Record<string, boolean> = {};
  errorInventoryItemsByWineCellarId: Record<string, string> = {};

  selectedSpace: WorkspaceSpace | null = null;
  selectedWineCellar: WorkspaceCellar | null = null;
  movementDialogOpen = false;
  exportDialogOpen = false;
  importDialogOpen = false;

  ngOnInit(): void {
    this.workspace.selectionChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ space, cellar }) => {
      if (this.selectedSpace?.id.value !== space?.id.value || this.selectedWineCellar?.id.value !== cellar?.id.value) this.optionsTrigger?.closeMenu();
      if (this.selectedSpace?.id.value !== space?.id.value) {
        this.inventoryItemsByWineCellarId = {};
        this.loadingInventoryItemsByWineCellarId = {};
        this.errorInventoryItemsByWineCellarId = {};
      }
      this.selectedSpace = space;
      this.selectedWineCellar = cellar;
      if (cellar && !this.inventoryItemsByWineCellarId[cellar.id.value] && !this.loadingInventoryItemsByWineCellarId[cellar.id.value]) {
        this.loadInventoryItems(cellar.id.value);
      }
      this.cdr.markForCheck();
    });
    this.workspace.ensureLoaded();
  }

  get selectedWineCellarInventoryItems(): readonly WineInventoryItem[] {
    if (!this.selectedWineCellar) return [];
    return this.inventoryItemsByWineCellarId[this.selectedWineCellar.id.value] ?? [];
  }

  get loadingSelectedWineCellarInventoryItems(): boolean {
    if (!this.selectedWineCellar) return false;
    return !!this.loadingInventoryItemsByWineCellarId[this.selectedWineCellar.id.value];
  }

  addWine(): void {
    if (!this.selectedWineCellar || !this.canAddWine) return;
    void this.router.navigate(['/inventory/new'], {
      queryParams: { spaceId: this.selectedSpace?.id.value, wineCellarId: this.selectedWineCellar.id.value },
    });
  }

  editWine(item: WineInventoryItem): void {
    if (!this.selectedWineCellar || !this.access.canInventory()) return;
    const wineCellarId = this.selectedWineCellar.id.value;
    if (item.wineCellarId.value !== wineCellarId) return;
    void this.router.navigate(['/inventory/edit', item.id.value], {
      queryParams: { spaceId: this.selectedSpace?.id.value, wineCellarId },
    });
  }

  deleteWineInventoryItem(item: WineInventoryItem): void {
    if (!this.selectedWineCellar || !this.access.canInventory()) return;
    const wineCellarId = this.selectedWineCellar.id.value;
    const spaceId = this.selectedSpace?.id.value;
    if (item.wineCellarId.value !== wineCellarId) return;
    this.dialog.open(DestructiveConfirmationDialogComponent, {
      ...DESTRUCTIVE_DIALOG_CONFIG,
      data: { title: 'Delete Wine', description: `Delete "${item.name}" from inventory? Its entire movement history will also be permanently deleted. This action cannot be undone.` },
    }).afterClosed().pipe(
      take(1),
      filter((confirmed) => confirmed === true && this.selectedSpace?.id.value === spaceId && this.selectedWineCellar?.id.value === wineCellarId && this.access.canInventory()),
      switchMap(() => this.wineInventoryItemCommandService.deleteInventoryItem(wineCellarId, item.id.value)),
      takeUntilDestroyed(this.destroyRef)
    )
      .subscribe({
        next: () => {
          if (this.selectedSpace?.id.value !== spaceId) return;
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

  openMovements(item: WineInventoryItem, mode: 'exit' | 'history'): void {
    const cellarId = this.selectedWineCellar?.id.value;
    const spaceId = this.selectedSpace?.id.value;
    if (this.movementDialogOpen || !cellarId || !spaceId || item.wineCellarId.value !== cellarId || (mode === 'exit' && (!this.access.canInventory() || item.quantity === 0))) return;
    this.movementDialogOpen = true;
    this.dialog.open(StockMovementDialogComponent, {
      width: '620px', maxWidth: '95vw', panelClass: 'inventory-management-dialog',
      data: { item, spaceId, mode },
    }).afterClosed().pipe(take(1), finalize(() => { this.movementDialogOpen = false; this.cdr.markForCheck(); }), takeUntilDestroyed(this.destroyRef)).subscribe((movement: StockMovement | undefined) => {
      if (!movement || this.selectedSpace?.id.value !== spaceId) return;
      // The POST already decremented stock atomically. Keep zero-stock items; never PUT here.
      const items = this.inventoryItemsByWineCellarId[cellarId] ?? [];
      this.inventoryItemsByWineCellarId = { ...this.inventoryItemsByWineCellarId,
        [cellarId]: items.map((current) => current.id.value === item.id.value ? { ...current, quantity: movement.stockAfter } : current),
      };
      this.cdr.markForCheck();
    });
  }

  refreshInventory(): void {
    if (this.selectedWineCellar && !this.loadingSelectedWineCellarInventoryItems) this.loadInventoryItems(this.selectedWineCellar.id.value);
  }

  showQuotas(): void {
    if (!this.selectedSpace || this.dialog.openDialogs.some(ref => ref.componentInstance instanceof SpaceQuotaDialogComponent)) return;
    this.dialog.open(SpaceQuotaDialogComponent, {
      width: '440px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog',
      ariaLabelledBy: 'space-quota-title', data: { spaceId: this.selectedSpace.id.value },
    });
  }

  openExportDialog(): void {
    if (!this.selectedSpace || this.exportDialogOpen) return;
    this.optionsTrigger?.closeMenu();
    this.exportDialogOpen = true;
    this.dialog.open(InventoryExportDialogComponent, {
      width: '520px', maxWidth: 'calc(100vw - 32px)', panelClass: 'inventory-management-dialog',
      ariaLabelledBy: 'inventory-export-title',
      data: { spaceId: this.selectedSpace.id.value, spaceName: this.selectedSpace.name,
        cellar: this.selectedWineCellar ? { id: this.selectedWineCellar.id.value, name: this.selectedWineCellar.name } : undefined },
    }).afterClosed().pipe(
      take(1), finalize(() => { this.exportDialogOpen = false; this.cdr.markForCheck(); }), takeUntilDestroyed(this.destroyRef),
    ).subscribe(downloaded => {
      if (downloaded === true) this.snackBar.open('Inventario exportado', 'Cerrar', { duration: 2500 });
    });
  }

  openImportDialog(): void {
    if (!this.selectedSpace || !this.selectedWineCellar || !this.access.canInventory() || !this.access.hasFeature('excel_export') || this.importDialogOpen) return;
    this.optionsTrigger?.closeMenu();
    this.importDialogOpen = true;
    const spaceId = this.selectedSpace.id.value;
    const cellarId = this.selectedWineCellar.id.value;
    const ref = this.dialog.open(InventoryImportDialogComponent, {
      width: '580px', maxWidth: 'calc(100vw - 32px)', panelClass: 'inventory-management-dialog',
      ariaLabelledBy: 'inventory-import-title',
      data: { spaceId, spaceName: this.selectedSpace.name, cellarId, cellarName: this.selectedWineCellar.name },
    });
    const unregisterClose = this.destroyRef.onDestroy(() => ref.close());
    const imported = ref.componentInstance.imported.subscribe(() => {
      if (this.selectedSpace?.id.value === spaceId && this.selectedWineCellar?.id.value === cellarId) this.loadInventoryItems(cellarId);
      // inventoryQuotaRefreshInterceptor already refreshes server-owned counters.
    });
    ref.afterClosed().pipe(take(1), finalize(() => {
      unregisterClose(); imported.unsubscribe(); this.importDialogOpen = false; this.cdr.markForCheck();
    }), takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  trackByWineInventoryItemId(_index: number, item: WineInventoryItem): string {
    return item.id.value;
  }

  get canAddWine(): boolean {
    return !!this.selectedWineCellar && this.access.canInventory() && !inventoryQuotaProjection(this.access.effectiveSpace(), 1, 0, false)?.exceeded;
  }

  private loadInventoryItems(wineCellarId: string): void {
    const spaceId = this.selectedSpace?.id.value;
    this.loadingInventoryItemsByWineCellarId = { ...this.loadingInventoryItemsByWineCellarId, [wineCellarId]: true };
    this.errorInventoryItemsByWineCellarId = { ...this.errorInventoryItemsByWineCellarId, [wineCellarId]: '' };
    this.cdr.markForCheck();

    this.wineInventoryItemQueryService
      .getInventoryItemsByWineCellar(wineCellarId)
      .pipe(
        catchError((error: unknown) => {
          if (this.selectedSpace?.id.value !== spaceId) return of([] as readonly WineInventoryItem[]);
          this.errorInventoryItemsByWineCellarId = {
            ...this.errorInventoryItemsByWineCellarId,
            [wineCellarId]: error instanceof Error ? error.message : 'No se pudieron cargar los items de inventario',
          };
          this.cdr.markForCheck();
          return of([] as readonly WineInventoryItem[]);
        }),
        finalize(() => {
          if (this.selectedSpace?.id.value !== spaceId) return;
          this.loadingInventoryItemsByWineCellarId = {
            ...this.loadingInventoryItemsByWineCellarId,
            [wineCellarId]: false,
          };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((inventoryItems) => {
        if (this.selectedSpace?.id.value !== spaceId) return;
        this.inventoryItemsByWineCellarId = { ...this.inventoryItemsByWineCellarId, [wineCellarId]: inventoryItems };
        this.cdr.markForCheck();
      });
  }

}
