import { I18nModule } from '../../../core/i18n/i18n.module';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError } from 'rxjs';
import { WorkspaceSpace } from '../../models/workspace-context';
import { SubscriptionApiService } from '../../services/subscription-api.service';
import { SubscriptionCatalog, findCatalogPlan, formatSubscriptionMoney } from '../../models/subscription';
import { I18nService } from '../../../core/i18n/i18n.service';

export interface SpaceLimitModalOptions {
  reason?: 'cellars' | 'items';
  current?: number;
  limit?: number;
  message?: string;
}

export type SpaceLimitModalData = WorkspaceSpace & SpaceLimitModalOptions;

@Component({
  selector: 'app-cellar-limit-modal', standalone: true,
  imports: [I18nModule, MatDialogModule, RouterLink],
  templateUrl: './cellar-limit-modal.html', styleUrl: './cellar-limit-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellarLimitModalComponent {
  readonly data = inject<SpaceLimitModalData>(MAT_DIALOG_DATA);
  private readonly subscriptions = inject(SubscriptionApiService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  readonly catalog = signal<SubscriptionCatalog | null>(this.subscriptions.catalog());

  readonly space = this.data;
  readonly reason = this.data.reason ?? 'cellars';
  readonly canManageSubscription = computed(() => {
    const overviewSpace = this.subscriptions.overview()?.space;
    if (overviewSpace && overviewSpace.id === this.data.id.value) return this.data.role === 'OWNER' && overviewSpace.role === 'OWNER' && overviewSpace.can_manage_subscription;
    return this.data.role === 'OWNER';
  });
  readonly freePlan = computed(() => findCatalogPlan(this.catalog(), this.data.spaceType, 'FREE'));
  readonly freeCellarsLimit = computed(() => this.freePlan()?.limits.cellars);
  readonly proPlan = computed(() => findCatalogPlan(this.catalog(), this.data.spaceType, 'PRO'));
  readonly proPriceSummary = computed(() => {
    const prices = this.proPlan()?.prices ?? [];
    if (!prices.length) return '';
    return prices.map((price) => `${formatSubscriptionMoney(price.amount, price.currency)} ${this.i18n.t('/ mes')}`).join(' · ');
  });

  constructor() {
    if (!this.catalog()) {
      this.subscriptions.getCatalog().pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe((catalog) => this.catalog.set(catalog));
    }
  }

  formatLimit(value: number | null | undefined, singular: string, plural: string, unlimitedLabel: string): string {
    if (value === undefined) return '';
    if (value === null) return unlimitedLabel;
    return value === 1 ? `1 ${singular}` : `${value} ${plural}`;
  }
}
