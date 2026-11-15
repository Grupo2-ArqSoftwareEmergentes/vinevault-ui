import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Injector, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, switchMap, take, tap } from 'rxjs';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { workspaceErrorMessage } from '../../services/workspace-api.service';
import { WorkspaceSpace } from '../../models/workspace-context';
import { DEVICE_COMMAND_SERVICE } from '../../../device/domain/services/device-command-service';
import { createUpdateSpaceNameCommand } from '../../../device/domain/model/commands/update-space-name.command';
import { createDeleteSpaceCommand } from '../../../device/domain/model/commands/delete-space.command';
import { DeleteSpaceDialogComponent } from '../../../device/interfaces/components/delete-space-dialog/delete-space-dialog.component';
import { DESTRUCTIVE_DIALOG_CONFIG } from '../destructive-confirmation-dialog/destructive-confirmation-dialog';

@Component({
  selector: 'app-manage-spaces-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './manage-spaces-dialog.html',
  styleUrl: './manage-spaces-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageSpacesDialogComponent {
  readonly workspace = inject(WorkspaceContextService);
  readonly dialogRef = inject(MatDialogRef<ManageSpacesDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  editingId: string | null = null;
  name = '';
  pendingId: string | null = null;
  error = '';

  constructor() { this.workspace.ensureLoaded(); }

  edit(space: WorkspaceSpace): void {
    if (this.pendingId) return;
    this.editingId = space.id.value;
    this.name = space.name;
    this.error = '';
  }

  rename(space: WorkspaceSpace): void {
    const name = this.name.trim();
    if (!name || this.pendingId) return;
    this.begin(space.id.value);
    this.injector.get(DEVICE_COMMAND_SERVICE).handleUpdateSpaceName(createUpdateSpaceNameCommand(space.id, name)).pipe(
      tap(() => {
        this.workspace.updateSpace({ ...space, name });
        this.editingId = null;
      }),
      catchError((error: unknown) => { this.error = workspaceErrorMessage(error, 'Unable to rename this space.'); return EMPTY; }),
      finalize(() => this.finish()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  delete(space: WorkspaceSpace): void {
    if (this.pendingId) return;
    this.begin(space.id.value);
    this.dialog.open(DeleteSpaceDialogComponent, DESTRUCTIVE_DIALOG_CONFIG).afterClosed().pipe(
      take(1),
      switchMap((confirmed: boolean | undefined) => confirmed === true
        ? this.injector.get(DEVICE_COMMAND_SERVICE).handleDeleteSpace(createDeleteSpaceCommand(space.id)).pipe(
            tap(() => { this.workspace.removeSpace(space.id.value); this.editingId = null; })
          )
        : EMPTY),
      catchError((error: unknown) => { this.error = workspaceErrorMessage(error, 'Unable to delete this space.'); return EMPTY; }),
      finalize(() => this.finish()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  private begin(id: string): void {
    this.error = '';
    this.pendingId = id;
    this.dialogRef.disableClose = true;
  }

  private finish(): void {
    this.pendingId = null;
    this.dialogRef.disableClose = false;
    this.cdr.markForCheck();
  }
}
