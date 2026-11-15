import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { WorkspaceSpace } from '../../models/workspace-context';
import { workspaceErrorMessage } from '../../services/workspace-api.service';

@Component({
  selector: 'app-workspace-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, A11yModule],
  templateUrl: './workspace-switcher.html',
  styleUrl: './workspace-switcher.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceSwitcherComponent {
  readonly workspace = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  open = false;
  search = '';
  creating: 'space' | 'cellar' | null = null;
  name = '';
  parentId = '';
  saving = false;
  error = '';

  constructor() { this.workspace.ensureLoaded(); }

  get visibleSpaces(): readonly WorkspaceSpace[] {
    const search = this.search.trim().toLocaleLowerCase();
    return this.workspace.spaces().filter((space) => !search ||
      space.name.toLocaleLowerCase().includes(search) ||
      this.workspace.cellars().some((cellar) => cellar.spaceId.value === space.id.value && cellar.name.toLocaleLowerCase().includes(search)));
  }

  cellarsFor(space: WorkspaceSpace) {
    const search = this.search.trim().toLocaleLowerCase();
    const matchesSpace = space.name.toLocaleLowerCase().includes(search);
    return this.workspace.cellars().filter((cellar) => cellar.spaceId.value === space.id.value &&
      (!search || matchesSpace || cellar.name.toLocaleLowerCase().includes(search)));
  }

  selectSpace(spaceId: string): void { this.workspace.chooseSpace(spaceId); this.close(); }
  selectCellar(cellarId: string): void { this.workspace.chooseCellar(cellarId); this.close(); }
  close(): void { this.open = false; this.search = ''; if (!this.saving) this.creating = null; }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this.close();
  }

  startCreate(kind: 'space' | 'cellar'): void {
    this.creating = kind;
    this.name = '';
    this.error = '';
    this.parentId = this.workspace.selection().space?.id.value ?? this.workspace.spaces()[0]?.id.value ?? '';
  }

  save(): void {
    if (!this.creating || !this.name.trim() || this.saving) return;
    this.saving = true;
    this.error = '';
    const kind = this.creating;
    try {
      const request: Observable<unknown> = kind === 'space' ? this.workspace.createSpace(this.name.trim())
        : this.workspace.createCellar(this.name.trim(), this.parentId);
      request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { this.saving = false; this.cdr.markForCheck(); })).subscribe({
        next: () => {
          this.creating = null;
          this.close();
          this.cdr.markForCheck();
        },
        error: (error: unknown) => { this.error = workspaceErrorMessage(error, 'Unable to create this workspace. Please retry.'); this.cdr.markForCheck(); },
      });
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unable to create this workspace.';
      this.saving = false;
    }
  }
}
