import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { WorkspaceAccessService } from '../../../../services/workspace-access.service';
import { SubscriptionApiService } from '../../../../services/subscription-api.service';
import {
  SubscriptionCatalog,
  SubscriptionCurrency,
  SubscriptionPrice,
  SubscriptionRequestRecord,
  findCatalogPlan,
  generateIdempotencyKey,
  isFulfilledSubscription,
} from '../../../../models/subscription';
import { apiErrorDetail } from '../../../../services/workspace-quota';
import { extractApiErrorMessage } from '../../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { proBenefits } from '../pro-benefits';
import { formatSolesMoney, formatSolesMonthly } from '../../../../models/subscription-summary';
import { subscriptionErrorMessage } from '../../../../models/subscription-error';
import { SimulatedCheckoutComponent } from '../simulated-checkout/simulated-checkout';
import { checkoutAmount, SimulatedPaymentModel } from '../simulated-checkout/simulated-payment.model';

export interface ProUpgradeDialogData {
  spaceId: string;
  cellarId?: string | null;
  catalog?: SubscriptionCatalog | null;
}

export interface ProUpgradeDialogResult {
  submitted?: boolean;
  intent?: SubscriptionRequestRecord;
  refreshContext?: boolean;
  refreshRequests?: boolean;
}

@Component({
  selector: 'app-pro-upgrade-dialog', standalone: true, imports: [CommonModule, MatDialogModule, SimulatedCheckoutComponent],
  templateUrl: './pro-upgrade-dialog.html', styleUrl: './pro-upgrade-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProUpgradeDialogComponent {
  readonly access = inject(WorkspaceAccessService);
  private readonly subscriptions = inject(SubscriptionApiService);
  readonly data = inject<ProUpgradeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProUpgradeDialogComponent, ProUpgradeDialogResult | undefined>);
  private readonly destroyRef = inject(DestroyRef);

  readonly catalog = signal<SubscriptionCatalog | null>(this.data.catalog ?? this.subscriptions.catalog());
  readonly loadingCatalog = signal(false);
  readonly loadingOverview = signal(false);
  readonly canManage = computed(() => this.subscriptions.overview()?.space?.id === this.data.spaceId && this.subscriptions.overview()?.space?.can_manage_subscription === true && this.access.canManage());
  readonly catalogError = signal('');
  readonly selectedCurrency = signal<SubscriptionCurrency>('');
  readonly idempotencyKey = signal(generateIdempotencyKey());
  readonly submitting = signal(false);
  readonly payment = new SimulatedPaymentModel();
  readonly checkoutTotal = computed(() => checkoutAmount(this.selectedPrice()?.amount));
  readonly fulfilled = computed(() => !!this.confirmedIntent() && isFulfilledSubscription(this.confirmedIntent()!));
  readonly submitError = signal('');
  readonly confirmedIntent = signal<SubscriptionRequestRecord | null>(null);
  readonly alreadyPro = signal(false);
  readonly upgradePending = signal(false);

  readonly purposeName = computed(() => this.access.purpose() === 'BUSINESS' ? 'Business' : 'Collector');
  readonly proPlan = computed(() => findCatalogPlan(this.catalog(), this.access.purpose(), 'PRO'));
  readonly availablePrices = computed(() => this.proPlan()?.prices.filter(price => price.currency === 'PEN') ?? []);
  readonly selectedPrice = computed<SubscriptionPrice | null>(() => {
    const prices = this.availablePrices();
    const chosen = this.selectedCurrency();
    return prices.find((price) => price.currency === chosen) ?? prices[0] ?? null;
  });
  readonly benefits = computed(() => proBenefits(this.access.purpose(), this.proPlan()));
  readonly formatMoney = formatSolesMoney;
  readonly formatQuoted = formatSolesMonthly;

  constructor() {
    this.destroyRef.onDestroy(() => this.payment.clear());
    if (this.subscriptions.overview()?.space?.id !== this.data.spaceId) {
      this.loadingOverview.set(true);
      this.subscriptions.getOverview(this.data.spaceId, this.data.cellarId ?? null).pipe(
        finalize(() => this.loadingOverview.set(false)), takeUntilDestroyed(this.destroyRef),
      ).subscribe({ error: error => this.submitError.set(subscriptionErrorMessage(error)) });
    }
    if (!this.catalog()) {
      this.loadCatalog(false);
    } else {
      this.syncSelectedCurrency();
    }

    // Never leave an offer attached to another Topbar context or an already changed plan/role.
    effect(() => {
      const hasTerminalOutcome = !!this.confirmedIntent() || this.alreadyPro() || this.upgradePending();
      if (this.access.space()?.id.value !== this.data.spaceId) {
        this.dialogRef.close();
        return;
      }
      if (!hasTerminalOutcome && (this.access.plan() !== 'FREE' || !this.access.canManageSubscription())) {
        this.dialogRef.close();
      }
    });
  }

  loadCatalog(forceRefresh: boolean): void {
    this.loadingCatalog.set(true);
    this.catalogError.set('');
    this.subscriptions.getCatalog(forceRefresh).pipe(
      finalize(() => this.loadingCatalog.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.syncSelectedCurrency();
      },
      error: (error: unknown) => {
        this.catalogError.set(extractApiErrorMessage(error, 'No se pudo cargar el catálogo oficial de precios.'));
      },
    });
  }

  selectCurrency(currency: SubscriptionCurrency): void {
    const normalized = currency.trim().toUpperCase();
    if (normalized !== 'PEN' || normalized === this.selectedCurrency() || this.submitting()) return;
    this.selectedCurrency.set(normalized);
    this.submitError.set('');
    // Parameters changed: generate a fresh idempotency key.
    this.idempotencyKey.set(generateIdempotencyKey());
  }

  submitUpgrade(): void {
    const price = this.selectedPrice();
    if (this.submitting() || this.loadingCatalog() || !price || this.confirmedIntent() || this.alreadyPro() || this.upgradePending()) return;
    if (!this.canManage() || this.loadingOverview() || this.access.plan() !== 'FREE') return;
    if (!this.checkoutTotal() || this.catalog()?.simulated_payment_available === false || !this.payment.authorize()) return;

    this.submitting.set(true);
    this.submitError.set('');
    this.dialogRef.disableClose = true;

    this.subscriptions.createPlanChangeRequest({
      space_id: this.data.spaceId,
      cellar_id: this.data.cellarId ?? null,
      target_plan: 'PRO',
      currency: price.currency,
      idempotency_key: this.idempotencyKey(),
      confirm_simulated_payment: true,
    }).pipe(
      finalize(() => {
        this.submitting.set(false);
        this.dialogRef.disableClose = false;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (intent) => {
        // Only refreshed overview/context may publish the resulting plan and quotas.
        this.confirmedIntent.set(intent);
        this.payment.clear();
        if (isFulfilledSubscription(intent)) this.dialogRef.close({ submitted: true, intent, refreshRequests: true });
      },
      error: (error: unknown) => this.handleSubmitError(error),
    });
  }

  closeDialog(): void {
    if (this.submitting()) return;
    this.payment.clear();
    const intent = this.confirmedIntent();
    if (intent) {
      this.dialogRef.close({ submitted: true, intent, refreshRequests: true });
    } else if (this.alreadyPro()) {
      this.dialogRef.close({ refreshRequests: true });
    } else if (this.upgradePending()) {
      this.dialogRef.close({ refreshRequests: true });
    } else {
      this.dialogRef.close();
    }
  }

  private syncSelectedCurrency(): void {
    const prices = this.availablePrices();
    if (!prices.length) {
      this.selectedCurrency.set('');
      return;
    }
    const current = this.selectedCurrency();
    if (!current || !prices.some((price) => price.currency === current)) {
      const next = prices[0].currency;
      if (current && current !== next) {
        this.idempotencyKey.set(generateIdempotencyKey());
      }
      this.selectedCurrency.set(next);
    }
  }

  private handleSubmitError(error: unknown): void {
    const detail = apiErrorDetail(error);
    if (error instanceof HttpErrorResponse && error.status === 409) {
      if (detail?.code === 'ALREADY_PRO') {
        this.alreadyPro.set(true);
        this.submitError.set(subscriptionErrorMessage(error));
        this.subscriptions.refreshState(this.data.spaceId, this.data.cellarId ?? null);
        return;
      }
      if (detail?.code === 'UPGRADE_PENDING') {
        this.upgradePending.set(true);
        this.submitError.set(subscriptionErrorMessage(error));
        return;
      }
      if (detail?.code === 'IDEMPOTENCY_CONFLICT') {
        this.idempotencyKey.set(generateIdempotencyKey());
        this.submitError.set(subscriptionErrorMessage(error));
        return;
      }
    }
    if (error instanceof HttpErrorResponse && error.status === 422 && detail?.code === 'CURRENCY_UNAVAILABLE') {
      this.submitError.set(subscriptionErrorMessage(error));
      this.loadCatalog(true);
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.submitError.set(subscriptionErrorMessage(error));
      return;
    }
    // Network/timeout/5xx error: preserve idempotency_key so retrying will not duplicate the intent.
    this.submitError.set(subscriptionErrorMessage(error));
  }
}
