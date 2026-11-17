import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SpaceQuotas } from '../../models/workspace-context';

@Component({
  selector: 'app-space-quota-summary', standalone: true, imports: [CommonModule],
  template: `<div *ngIf="quotas" class="flex flex-wrap gap-3 text-xs text-[#8B949E]" aria-label="Cuotas de todo el espacio"><span *ngFor="let field of fields">{{ field.label }}: {{ quotas[field.key].used }} / {{ quotas[field.key].limit === null ? 'Sin límite' : quotas[field.key].limit }}<span *ngIf="quotas[field.key].remaining !== null"> · {{ quotas[field.key].remaining }} disponibles</span></span></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceQuotaSummaryComponent {
  @Input() quotas: SpaceQuotas | undefined;
  readonly fields: readonly { key: keyof SpaceQuotas; label: string }[] = [
    { key: 'cellars', label: 'Cavas' }, { key: 'bottles', label: 'Botellas' }, { key: 'skus', label: 'SKUs' },
  ];
}
