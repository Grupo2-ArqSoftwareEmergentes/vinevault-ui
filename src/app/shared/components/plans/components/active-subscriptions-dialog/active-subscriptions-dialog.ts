import { I18nModule } from '../../../../../core/i18n/i18n.module';
import { ChangeDetectionStrategy, Component, Signal, effect, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ActiveSubscription } from '../../../../models/subscription';
import { formatSolesMonthly } from '../../../../models/subscription-summary';
import { I18nService } from '../../../../../core/i18n/i18n.service';

export interface ActiveSubscriptionsDialogData {
  items: Signal<readonly ActiveSubscription[]>;
  loading: Signal<boolean>;
  available: Signal<boolean>;
  error: Signal<string>;
  cancellingIds: Signal<ReadonlySet<string>>;
  spaceId: Signal<string | null>;
  spaceName: (id: string | null) => string;
  dateLabel: (date: string | null) => string;
  canCancel: (item: ActiveSubscription) => boolean;
  cancel: (item: ActiveSubscription) => void;
  retry: () => void;
}

@Component({
  selector: 'app-active-subscriptions-dialog', standalone: true, imports: [I18nModule, MatDialogModule],
  templateUrl: './active-subscriptions-dialog.html', styleUrl: './active-subscriptions-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveSubscriptionsDialogComponent {
  readonly data = inject<ActiveSubscriptionsDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ActiveSubscriptionsDialogComponent>);
  private readonly i18n = inject(I18nService);
  readonly formatMonthly = (amount: string | null | undefined, currency: string | null | undefined) => this.i18n.t(formatSolesMonthly(amount, currency ?? '').replace(' / mes', this.i18n.t(' / mes')));

  constructor() {
    const spaceId = this.data.spaceId();
    effect(() => { if (this.data.spaceId() !== spaceId) this.ref.close(); });
  }
}
