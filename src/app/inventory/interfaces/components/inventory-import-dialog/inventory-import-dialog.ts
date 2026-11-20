import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, defer, finalize, take } from 'rxjs';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { WineInventoryImportResult } from '../../../domain/services/wine-inventory-item-command-service';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { workspaceErrorMessage } from '../../../../shared/services/workspace-api.service';
import { InventoryFileDownloadService, inventoryExportError } from '../../services/inventory-file-download';

export interface InventoryImportDialogData { spaceId: string; spaceName: string; cellarId: string; cellarName: string; }

function importObservation(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return String(value);
  const labels: Record<string, string> = { row: 'Fila', row_number: 'Fila', header: 'Encabezado duplicado', missing_header: 'Falta el encabezado', unknown_header: 'Encabezado desconocido', field: 'Campo', message: 'Detalle', msg: 'Detalle', loc: 'Ubicación' };
  return Object.entries(value).map(([key, detail]) => `${labels[key] ?? key}: ${typeof detail === 'object' ? JSON.stringify(detail) : String(detail)}`).join(' · ');
}

@Component({
  selector: 'app-inventory-import-dialog', standalone: true,
  imports: [MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './inventory-import-dialog.html', styleUrl: './inventory-import-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryImportDialogComponent {
  readonly data = inject<InventoryImportDialogData>(MAT_DIALOG_DATA);
  private readonly commands = inject(WineInventoryItemCommandServiceImpl);
  private readonly download = inject(InventoryFileDownloadService);
  private readonly workspace = inject(WorkspaceContextService);
  readonly access = inject(WorkspaceAccessService);
  private readonly ref = inject(MatDialogRef<InventoryImportDialogComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subscription();
  private closed = false;
  readonly imported = new EventEmitter<WineInventoryImportResult>();
  readonly file = signal<File | null>(null);
  readonly importing = signal(false);
  readonly downloading = signal(false);
  readonly error = signal('');
  readonly templateError = signal('');
  readonly templateReady = signal(false);
  readonly observations = signal<readonly string[]>([]);
  readonly result = signal<WineInventoryImportResult | null>(null);
  readonly uncertain = signal(false);

  constructor() {
    this.ref.beforeClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.closed = true; this.requests.unsubscribe(); });
    this.destroyRef.onDestroy(() => { this.closed = true; this.requests.unsubscribe(); });
    effect(() => { if (!this.currentContext() || !this.access.canInventory()) this.ref.close(); });
  }

  private currentContext(): boolean {
    const { space, cellar } = this.workspace.selection();
    return !this.closed && space?.id.value === this.data.spaceId && cellar?.id.value === this.data.cellarId;
  }

  selectFile(event: Event): void {
    if (this.importing() || this.uncertain() || this.result()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.error.set(''); this.observations.set([]); this.file.set(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx') || !file.size) {
      this.error.set('Selecciona un archivo Excel (.xlsx) que no esté vacío. PDF no es importable.');
      return;
    }
    this.file.set(file);
  }

  downloadTemplate(): void {
    if (!this.currentContext() || this.downloading() || !this.access.canInventory() || !this.access.hasFeature('excel_export')) return;
    this.downloading.set(true); this.templateError.set(''); this.templateReady.set(false);
    this.requests.add(defer(() => this.commands.getInventoryTemplate(this.data.cellarId)).pipe(
      take(1), finalize(() => this.downloading.set(false)), takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: response => {
        if (!this.currentContext()) return;
        if (!response.body?.size || /json|text\/html/i.test(response.body.type)) { this.templateError.set('No se recibió una plantilla válida. Inténtalo de nuevo.'); return; }
        try { this.download.download(response, 'plantilla-inventario.xlsx'); this.templateReady.set(true); }
        catch { this.templateError.set('No se pudo iniciar la descarga de la plantilla.'); }
      },
      error: async error => {
        const message = await inventoryExportError(error);
        if (this.currentContext()) this.templateError.set(`No se pudo descargar la plantilla. ${message}`);
      },
    }));
  }

  import(): void {
    const file = this.file();
    if (!file || this.importing() || this.result() || this.uncertain() || !this.currentContext() || !this.access.canInventory() || !this.access.hasFeature('excel_export')) return;
    this.error.set(''); this.observations.set([]); this.importing.set(true);
    this.requests.add(defer(() => this.commands.importInventory(this.data.cellarId, file)).pipe(
      take(1), finalize(() => this.importing.set(false)), takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: result => {
        if (!this.currentContext()) return;
        this.result.set(result);
        this.imported.emit(result);
      },
      error: (error: unknown) => {
        if (!this.currentContext()) return;
        const uncertain = !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
        this.uncertain.set(uncertain);
        this.error.set(uncertain
          ? 'No se pudo confirmar el resultado. La importación puede haberse aplicado. Cierra este modal y pulsa Refresh para revisar el inventario antes de volver a importar.'
          : workspaceErrorMessage(error, 'No se pudo importar el archivo. Revisa la plantilla y corrige las observaciones.'));
        const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
        const errors: unknown = detail?.errors ?? (Array.isArray(detail) ? detail : []);
        if (Array.isArray(errors)) this.observations.set(errors.map(importObservation));
      },
    }));
  }
}
