import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { workspaceErrorMessage } from '../../../../shared/services/workspace-api.service';
import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';

@Component({
  selector: 'app-onboarding', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.html',
})
export class OnboardingComponent {
  readonly workspace = inject(WorkspaceContextService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  name = '';
  spaceType: SpaceType = 'COLLECTOR';
  saving = false;
  completed = false;
  error = '';

  constructor() {
    effect(() => {
      if (this.workspace.loaded() && this.workspace.spaces().length && !this.saving && !this.completed) {
        void this.router.navigate(['/overview']);
      }
    });
  }

  submit(): void {
    if (!this.name.trim() || this.saving || this.completed || this.workspace.spaces().length || !this.workspace.loaded()) return;
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();
    this.workspace.onboard(this.name, this.spaceType).pipe(
      finalize(() => { this.saving = false; this.cdr.markForCheck(); }), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => {
        this.completed = true;
        void this.router.navigate(['/overview'], { queryParams: { spaceId: created.space.id.value, wineCellarId: created.cellar.id.value } });
      },
      error: (error: unknown) => { this.error = workspaceErrorMessage(error, 'Unable to create your first space.'); this.cdr.markForCheck(); },
    });
  }
}
