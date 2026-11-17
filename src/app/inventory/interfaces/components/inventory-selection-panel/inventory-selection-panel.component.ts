import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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
import { AIStockAnalysisComponent } from '../../../../invetory_intelligence/interfaces/components/ai-stock-analysis/ai-stock-analysis.component';
import { StockMovementDialogComponent } from '../stock-movement-dialog/stock-movement-dialog';
import { StockMovement } from '../../../domain/model/stock-movement';
import { inventoryQuotaProjection } from '../../../../shared/services/workspace-quota';
import { SpaceQuotaSummaryComponent } from '../../../../shared/components/space-quota-summary/space-quota-summary';
import { workspaceErrorMessage } from '../../../../shared/services/workspace-api.service';

@Component({
  selector: 'app-inventory-selection-panel',
  standalone: true,
  imports: [
    CanSpaceDirective,
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    AIStockAnalysisComponent,
    SpaceQuotaSummaryComponent,
  ],
  templateUrl: './inventory-selection-panel.component.html',
  styleUrl: './inventory-selection-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventorySelectionPanelComponent implements OnInit {
  @ViewChild('inventoryFileInput') private readonly inventoryFileInput?: ElementRef<HTMLInputElement>;

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
  exportingInventoryByWineCellarId: Record<string, boolean> = {};
  downloadingTemplateByWineCellarId: Record<string, boolean> = {};
  importingInventoryByWineCellarId: Record<string, boolean> = {};
  errorInventoryItemsByWineCellarId: Record<string, string> = {};

  selectedSpace: WorkspaceSpace | null = null;
  selectedWineCellar: WorkspaceCellar | null = null;
  movementDialogOpen = false;

  ngOnInit(): void {
    this.workspace.selectionChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ space, cellar }) => {
      if (this.selectedSpace?.id.value !== space?.id.value) {
        this.inventoryItemsByWineCellarId = {};
        this.loadingInventoryItemsByWineCellarId = {};
        this.errorInventoryItemsByWineCellarId = {};
        this.exportingInventoryByWineCellarId = {};
        this.downloadingTemplateByWineCellarId = {};
        this.importingInventoryByWineCellarId = {};
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
    if (!this.access.canInventory()) return;
    if (!this.selectedWineCellar || !this.inventoryFileInput) return;

    this.inventoryFileInput.nativeElement.value = '';
    this.inventoryFileInput.nativeElement.click();
  }

  onInventoryFileSelected(event: Event): void {
    if (!this.access.canInventory()) return;
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
          this.snackBar.open(workspaceErrorMessage(error, 'No se pudo importar el inventario'), 'Close', { duration: 4000 });
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

  trackByWineInventoryItemId(_index: number, item: WineInventoryItem): string {
    return item.id.value;
  }

  get canAddWine(): boolean {
    return !!this.selectedWineCellar && this.access.canInventory() && !inventoryQuotaProjection(this.selectedSpace, 0, 0, false)?.exceeded;
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

}
