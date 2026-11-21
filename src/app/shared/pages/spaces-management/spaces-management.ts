import { I18nModule } from '../../../core/i18n/i18n.module';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, Injector, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, defer, finalize, switchMap, take, tap } from 'rxjs';
import { HeaderComponent } from '../../components/header/header';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { workspaceErrorMessage } from '../../services/workspace-api.service';
import { WorkspaceSpace } from '../../models/workspace-context';
import { hasSpacePermission } from '../../../device/domain/model/valueobjects/space-access';
import { DEVICE_COMMAND_SERVICE } from '../../../device/domain/services/device-command-service';
import { createUpdateSpaceNameCommand } from '../../../device/domain/model/commands/update-space-name.command';
import { createDeleteSpaceCommand } from '../../../device/domain/model/commands/delete-space.command';
import { DeleteSpaceDialogComponent } from '../../../device/interfaces/components/delete-space-dialog/delete-space-dialog.component';
import { DESTRUCTIVE_DIALOG_CONFIG } from '../../components/destructive-confirmation-dialog/destructive-confirmation-dialog';
import { CreateSpaceDialogComponent } from '../../components/create-space-dialog/create-space-dialog';
import { ManagementBackLinkComponent } from '../../components/management-back-link/management-back-link';

@Component({
  selector: 'app-spaces-management', standalone: true,
  imports: [I18nModule, CommonModule, FormsModule, RouterLink, HeaderComponent, SidebarComponent, ManagementBackLinkComponent],
  templateUrl: './spaces-management.html', styleUrl: './spaces-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpacesManagementComponent {
  readonly workspace = inject(WorkspaceContextService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  isSidebarOpen = window.innerWidth > 768;
  editingId: string | null = null;
  pendingId: string | null = null;
  name = '';
  error = '';
  @ViewChild('titleInput') set titleInput(input: ElementRef<HTMLInputElement> | undefined) {
    input?.nativeElement.focus();
    input?.nativeElement.select();
  }
  canManage = (space: WorkspaceSpace) => hasSpacePermission(
    this.workspace.spaces().find((item) => item.id.value === space.id.value), 'MANAGE');

  constructor() { this.workspace.ensureLoaded(); }

  add(): void {
    if (this.pendingId) return;
    this.dialog.open(CreateSpaceDialogComponent, {
      width: '800px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog',
      ariaLabelledBy: 'create-space-title',
    });
  }

  edit(space: WorkspaceSpace): void {
    if (this.pendingId || !this.canManage(space)) return;
    this.editingId = space.id.value;
    this.name = space.name;
    this.error = '';
  }

  cancelEdit(): void {
    if (this.pendingId) return;
    this.editingId = null;
    this.name = '';
    this.error = '';
  }

  rename(space: WorkspaceSpace): void {
    const name = this.name.trim();
    if (!name || this.pendingId || !this.canManage(space)) return;
    this.pendingId = space.id.value;
    this.error = '';
    defer(() => this.injector.get(DEVICE_COMMAND_SERVICE).handleUpdateSpaceName(createUpdateSpaceNameCommand(space.id, name))).pipe(
      tap(() => { this.workspace.updateSpace({ ...space, name }); this.editingId = null; }),
      catchError((error: unknown) => { this.error = workspaceErrorMessage(error, 'Unable to rename this space.'); return EMPTY; }),
      finalize(() => { this.pendingId = null; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  delete(space: WorkspaceSpace): void {
    if (this.pendingId || !this.canManage(space)) return;
    this.pendingId = space.id.value;
    this.error = '';
    this.dialog.open(DeleteSpaceDialogComponent, DESTRUCTIVE_DIALOG_CONFIG).afterClosed().pipe(
      take(1),
      switchMap((confirmed: boolean | undefined) => confirmed === true && this.canManage(space)
        ? defer(() => this.injector.get(DEVICE_COMMAND_SERVICE).handleDeleteSpace(createDeleteSpaceCommand(space.id))).pipe(
            tap(() => { this.workspace.removeSpace(space.id.value); this.editingId = null; }))
        : EMPTY),
      catchError((error: unknown) => { this.error = workspaceErrorMessage(error, 'Unable to delete this space.'); return EMPTY; }),
      finalize(() => { this.pendingId = null; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
}
