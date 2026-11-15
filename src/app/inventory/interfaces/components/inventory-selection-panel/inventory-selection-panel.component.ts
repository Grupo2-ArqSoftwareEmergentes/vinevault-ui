import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, finalize, of } from 'rxjs';

import { WorkspaceCellar, WorkspaceSpace } from '../../../../shared/models/workspace-context';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
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
  readonly workspace = inject(WorkspaceContextService);
  private readonly dialog = inject(MatDialog);
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

  ngOnInit(): void {
    this.workspace.selectionChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ space, cellar }) => {
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

  openAddWineDialog(): void {
    if (!this.selectedWineCellar) return;

    const dialogRef = this.dialog.open(AddWineInventoryItemDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'inventory-management-dialog',
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
      panelClass: 'inventory-management-dialog',
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

  trackByWineInventoryItemId(_index: number, item: WineInventoryItem): string {
    return item.id.value;
  }

  get canAddWine(): boolean {
    return !!this.selectedWineCellar;
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

}
