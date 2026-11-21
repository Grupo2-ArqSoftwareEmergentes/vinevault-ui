import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { SpacePermission } from '../../device/domain/model/valueobjects/space-access';
import { WorkspaceAccessService } from '../services/workspace-access.service';

/** Presentation only; missing roles deny actions and the backend validates every request. */
@Directive({ selector: '[appCan]', standalone: true })
export class CanSpaceDirective {
  readonly appCan = input.required<SpacePermission>();
  private readonly access = inject(WorkspaceAccessService);
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);
  private shown = false;
  constructor() {
    effect(() => {
      const allowed = this.access.can(this.appCan());
      if (allowed === this.shown) return;
      this.container.clear();
      if (allowed) this.container.createEmbeddedView(this.template);
      this.shown = allowed;
    });
  }
}
