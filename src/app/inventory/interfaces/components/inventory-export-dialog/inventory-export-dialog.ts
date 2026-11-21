import { I18nModule } from '../../../../core/i18n/i18n.module';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, catchError, defer, finalize, from, map, take } from 'rxjs';
import { InventoryExportFormat } from '../../../domain/services/wine-inventory-item-command-service';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { InventoryFileDownloadService, inventoryExportError } from '../../services/inventory-file-download';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { PlanFeatureNoticeComponent } from '../../../../shared/components/plan-feature-notice/plan-feature-notice';
import { apiErrorDetailAsync } from '../../../../shared/services/workspace-quota';
import { I18nService } from '../../../../core/i18n/i18n.service';

export interface InventoryExportDialogData { spaceId: string; spaceName: string; cellar?: { id: string; name: string }; }

@Component({
  selector: 'app-inventory-export-dialog', standalone: true,
  imports: [I18nModule, ReactiveFormsModule, MatDialogModule, MatProgressSpinnerModule, PlanFeatureNoticeComponent],
  templateUrl: './inventory-export-dialog.html', styleUrl: './inventory-export-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryExportDialogComponent {
  readonly data = inject<InventoryExportDialogData>(MAT_DIALOG_DATA);
  readonly access = inject(WorkspaceAccessService);
  private readonly i18n = inject(I18nService);
  get feature() { return this.form.controls.format.value === 'pdf' ? 'pdf_report' as const : 'excel_export' as const; }
  closeForUpgrade(): void { this.ref.close(); }
  private readonly commands = inject(WineInventoryItemCommandServiceImpl);
  private readonly fileDownload = inject(InventoryFileDownloadService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly ref = inject(MatDialogRef<InventoryExportDialogComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private closing = false;
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly featureUnavailable = signal(false);
  readonly form = new FormGroup({
    scope: new FormControl<'space' | 'cellar'>(this.data.cellar ? 'cellar' : 'space', { nonNullable: true }),
    format: new FormControl<InventoryExportFormat>('xlsx', { nonNullable: true }),
  });
  get scopeLabel(): string { return this.form.controls.scope.value === 'cellar' ? `${this.i18n.t('Cava:')} ${this.data.cellar?.name}` : this.i18n.t('Espacio completo'); }

  constructor() {
    this.ref.beforeClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.closing = true; this.request?.unsubscribe(); });
    effect(() => {
      if (!this.currentContext()) { this.request?.unsubscribe(); this.ref.close(); }
    });
  }
  private currentContext(): boolean {
    const { space, cellar } = this.workspace.selection();
    return space?.id.value === this.data.spaceId && cellar?.id.value === this.data.cellar?.id;
  }
  export(): void {
    if (this.closing || this.exporting() || !this.currentContext()) return;
    const { scope, format } = this.form.getRawValue();
    if (!this.access.hasFeature(this.feature)) return;
    if (!this.data.spaceId || !['xlsx', 'pdf'].includes(format) || !['space', 'cellar'].includes(scope) || (scope === 'cellar' && !this.data.cellar)) return;
    this.error.set('');
    this.featureUnavailable.set(false);
    this.exporting.set(true);
    this.request = defer(() => this.commands.exportInventory(this.data.spaceId, format, scope === 'cellar' ? this.data.cellar?.id : undefined)).pipe(
      take(1),
      catchError(error => from(Promise.all([inventoryExportError(error), apiErrorDetailAsync(error)])).pipe(map(([message, detail]) => {
        if (this.currentContext() && !(error instanceof HttpErrorResponse && error.status === 401)) {
          this.error.set(message);
          this.featureUnavailable.set(detail?.code === 'PLAN_FEATURE_UNAVAILABLE');
        }
        return null;
      }))),
      finalize(() => this.exporting.set(false)), takeUntilDestroyed(this.destroyRef),
    ).subscribe(response => {
      if (!response || !this.currentContext()) return;
      if (!response.ok || !response.body || !response.body.size || /json|text\/html/i.test(response.body.type + ' ' + response.headers.get('Content-Type'))) {
        this.error.set('El servidor no devolvió un archivo de inventario válido. Puedes reintentarlo.');
        return;
      }
      try { this.fileDownload.download(response, `inventario.${format}`); this.ref.close(true); }
      catch { this.error.set('No se pudo iniciar la descarga del archivo. Puedes reintentarlo.'); }
    });
  }
}
