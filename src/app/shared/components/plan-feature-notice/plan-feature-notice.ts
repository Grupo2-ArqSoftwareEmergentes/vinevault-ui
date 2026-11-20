import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanFeature } from '../../models/subscription';
import { WorkspaceAccessService } from '../../services/workspace-access.service';

@Component({
  selector: 'app-plan-feature-notice', standalone: true, imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (access.space() && (unavailable() || !access.hasFeature(feature()))) {
    <p role="status">{{ unavailable() || access.capabilities()[feature()] === false ? 'Requiere Pro en este espacio.' : access.capabilities()[feature()] === true ? 'Tu rol no permite esta función.' : 'Capacidad pendiente de confirmar con el servidor.' }}
      @if ((unavailable() || access.capabilities()[feature()] === false) && access.canManageSubscription()) {
        <a routerLink="/subscription" [queryParams]="{ spaceId: access.space()?.id?.value }" (click)="upgrade.emit()">Ver actualización a Pro</a>
      }
    </p>
  }`,
  styles: [`p { margin: 8px 0; color: #c9b775; font-size: 12px; line-height: 1.6; } a { display: inline-block; margin-left: 8px; color: #edcf7e; text-decoration: underline; } a:focus-visible { outline: 2px solid #d4af37; outline-offset: 3px; }`],
})
export class PlanFeatureNoticeComponent {
  readonly access = inject(WorkspaceAccessService);
  readonly feature = input.required<PlanFeature>();
  readonly unavailable = input(false);
  readonly upgrade = output<void>();
}
