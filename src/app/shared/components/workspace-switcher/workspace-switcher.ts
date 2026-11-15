import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, finalize, map } from 'rxjs';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { WorkspaceCellar, WorkspaceSpace } from '../../models/workspace-context';
import { WineCellarCreationService } from '../../../cava/interfaces/services/wine-cellar-creation.service';
import { workspaceErrorMessage } from '../../services/workspace-api.service';

@Component({
  selector: 'app-workspace-switcher',
  standalone: true,
  providers: [WineCellarCreationService],
  imports: [CommonModule, FormsModule, OverlayModule, A11yModule],
  templateUrl: './workspace-switcher.html',
  styleUrl: './workspace-switcher.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceSwitcherComponent {
  readonly workspace = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly cellarCreation = inject(WineCellarCreationService);
  open: 'space' | 'cellar' | null = null;
  search = '';
  creating: 'space' | null = null;
  name = '';
  saving = false;
  error = '';

  constructor() {
    this.workspace.ensureLoaded();
    this.workspace.selectionChanges.pipe(
      map(({ space }) => space?.id.value ?? null), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.open === 'cellar') this.close();
      this.cdr.markForCheck();
    });
  }

  get visibleSpaces(): readonly WorkspaceSpace[] {
    const search = this.search.trim().toLocaleLowerCase();
    return this.workspace.spaces().filter((space) => !search || space.name.toLocaleLowerCase().includes(search));
  }

  get spaceCellars(): readonly WorkspaceCellar[] {
    const spaceId = this.workspace.selection().space?.id.value;
    return this.workspace.cellars().filter((cellar) => cellar.spaceId.value === spaceId);
  }

  get visibleCellars(): readonly WorkspaceCellar[] {
    const search = this.search.trim().toLocaleLowerCase();
    return this.spaceCellars.filter((cellar) => !search || cellar.name.toLocaleLowerCase().includes(search));
  }

  toggle(kind: 'space' | 'cellar'): void {
    if (this.saving || (kind === 'cellar' && !this.workspace.selection().space)) return;
    const wasOpen = this.open === kind;
    this.close();
    if (!wasOpen) this.open = kind;
  }

  selectSpace(spaceId: string): void { this.workspace.chooseSpace(spaceId); this.close(); }
  selectCellar(cellarId: string): void { this.workspace.chooseCellar(cellarId); this.close(); }
  close(): void { this.open = null; this.search = ''; if (!this.saving) this.creating = null; }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this.close();
  }

  startCreate(kind: 'space' | 'cellar'): void {
    if (kind === 'cellar') {
      const spaceId = this.workspace.selection().space?.id.value;
      if (!spaceId) return;
      this.close();
      // Detach the dropdown and release its focus trap before the modal opens.
      this.cdr.detectChanges();
      this.cellarCreation.open(spaceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      return;
    }
    this.creating = kind;
    this.name = '';
    this.error = '';
  }

  save(): void {
    if (!this.creating || !this.name.trim() || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      const request = this.workspace.createSpace(this.name.trim());
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
