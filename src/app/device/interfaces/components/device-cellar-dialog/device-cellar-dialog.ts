import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize, takeUntil } from 'rxjs';
import { I18nModule } from '../../../../core/i18n/i18n.module';
import { Device, DEVICE_QUERY_SERVICE } from '../../../domain/services/device-query-service';
import { DEVICE_COMMAND_SERVICE } from '../../../domain/services/device-command-service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellar } from '../../../../cava/domain/services/wine-cellar-query-service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { createGetDeviceByIdQuery } from '../../../domain/model/queries/get-device-by-id.query';
import { extractApiErrorMessage } from '../../rest/transform/extract-api-error-message.transform';

@Component({
  selector: 'app-device-cellar-dialog', standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, I18nModule],
  templateUrl: './device-cellar-dialog.html',
  styleUrls: ['../../styles/device-management-dialog.css', './device-cellar-dialog.css'],
})
export class DeviceCellarDialogComponent {
  readonly device = inject<Device>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DeviceCellarDialogComponent, Device | undefined>);
  private readonly query = inject(DEVICE_QUERY_SERVICE);
  private readonly commands = inject(DEVICE_COMMAND_SERVICE);
  private readonly cellarQuery = inject(WineCellarQueryServiceImpl);
  private readonly scope = inject(WorkspaceScopeService);
  private readonly access = inject(WorkspaceAccessService);
  private readonly destroyRef = inject(DestroyRef);
  readonly cellarId = new FormControl(this.device.cellarId ?? '', { nonNullable: true });
  readonly cellars = signal<readonly WineCellar[]>([]);
  readonly current = signal(this.device.cellarId ?? '');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly ready = signal(false);
  readonly error = signal('');
  readonly canEdit = computed(() => this.access.canConfigure() && this.access.space()?.id.value === this.device.spaceId?.value);

  constructor() {
    this.scope.changed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.ref.close());
    this.load();
  }

  load(): void {
    const spaceId = this.device.spaceId?.value;
    if (!spaceId || !this.canEdit() || this.loading() || this.saving()) return;
    this.loading.set(true); this.ready.set(false); this.error.set('');
    this.cellarId.disable({ emitEvent: false });
    forkJoin({ device: this.query.handleGetDeviceById(createGetDeviceByIdQuery(this.device.id)), cellars: this.cellarQuery.getWineCellarsBySpace(spaceId) }).pipe(
      takeUntil(this.scope.changed), takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.loading.set(false);
        if (this.ready() && this.canEdit()) this.cellarId.enable({ emitEvent: false });
      })
    ).subscribe({
      next: ({ device, cellars }) => {
        if (!device || device.spaceId?.value !== spaceId) { this.error.set('No se pudo cargar la asignación actual del sensor.'); return; }
        this.cellars.set(cellars.filter(cellar => cellar.spaceId.value === spaceId));
        this.current.set(device.cellarId ?? ''); this.cellarId.setValue(this.current()); this.ready.set(true);
      },
      error: () => this.error.set('No se pudieron cargar las cavas'),
    });
  }

  submit(): void {
    const target = this.cellarId.value;
    if (!this.canEdit() || !this.ready() || this.loading() || this.saving() || target === this.current()) return;
    if (target && !this.cellars().some(cellar => cellar.id.value === target && (!cellar.deviceId || cellar.deviceId.value === this.device.id.value))) {
      this.error.set('La cava ya no está disponible. Elige otra o deja el sensor sin asociar.'); return;
    }
    this.saving.set(true); this.error.set(''); this.ref.disableClose = true;
    this.cellarId.disable({ emitEvent: false });
    this.commands.handleUpdateDeviceCellar({ deviceId: this.device.id, cellarId: target || null }).pipe(
      takeUntil(this.scope.changed), takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.saving.set(false); this.ref.disableClose = false; if (this.canEdit()) this.cellarId.enable({ emitEvent: false }); })
    ).subscribe({
      next: updated => this.ref.close(updated),
      error: error => this.error.set(extractApiErrorMessage(error, 'No se pudo cambiar la cava del sensor.')),
    });
  }
}
