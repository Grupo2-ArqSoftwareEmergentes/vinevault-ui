import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize } from 'rxjs';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { workspaceErrorMessage } from '../../services/workspace-api.service';
import { SpaceType } from '../../../device/domain/model/valueobjects/space-access';
import { apiErrorDetail, canCreateSpace } from '../../services/workspace-quota';
import { SubscriptionApiService } from '../../services/subscription-api.service';
import {
  SubscriptionCatalog,
  SubscriptionCurrency,
  SubscriptionPrice,
  SubscriptionRequestRecord,
  findCatalogAddon,
  generateIdempotencyKey,
} from '../../models/subscription';
import { extractApiErrorMessage } from '../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { formatSolesMoney, formatSolesMonthly } from '../../models/subscription-summary';

export interface CreateSpaceDialogData {
  mode?: 'create' | 'extra-space';
  current?: number;
  limit?: number;
  message?: string;
}

@Component({
  selector: 'app-create-space-dialog', standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './create-space-dialog.html', styleUrl: './create-space-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateSpaceDialogComponent {
  readonly dialogRef = inject(MatDialogRef<CreateSpaceDialogComponent>);
  readonly workspace = inject(WorkspaceContextService);
  private readonly subscriptions = inject(SubscriptionApiService);
  readonly data = inject<CreateSpaceDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly forcedExtraSpace = signal(this.data?.mode === 'extra-space');
  readonly userRequestedExtraSpace = signal(false);
  readonly quotaExhausted = computed(() => {
    const quota = this.workspace.accountQuota();
    return !!quota && (quota.remaining_spaces === 0 || (!quota.can_create_collector && !quota.can_create_business));
  });
  readonly showExtraSpaceOffer = computed(() => this.forcedExtraSpace() || this.quotaExhausted() || this.userRequestedExtraSpace());

  readonly catalog = signal<SubscriptionCatalog | null>(this.subscriptions.catalog());
  readonly loadingCatalog = signal(false);
  readonly catalogError = signal('');
  readonly extraSpaceAddon = computed(() => findCatalogAddon(this.catalog(), 'EXTRA_SPACE'));
  readonly availablePrices = computed(() => this.extraSpaceAddon()?.prices.filter(price => price.currency === 'PEN') ?? []);
  readonly selectedCurrency = signal<SubscriptionCurrency>('');
  readonly selectedPrice = computed<SubscriptionPrice | null>(() => {
    const prices = this.availablePrices();
    const chosen = this.selectedCurrency();
    return prices.find((price) => price.currency === chosen) ?? prices[0] ?? null;
  });
  readonly quantityInput = signal<number>(1);
  readonly validQuantity = computed(() => {
    const value = this.quantityInput();
    return Number.isInteger(value) && value >= 1 && value <= 100;
  });
  readonly idempotencyKey = signal(generateIdempotencyKey());
  readonly submittingExtraSpace = signal(false);
  readonly extraSpaceError = signal('');
  readonly confirmedIntent = signal<SubscriptionRequestRecord | null>(null);
  readonly formatMoney = formatSolesMoney;
  readonly formatQuoted = formatSolesMonthly;

  canCreate(purpose: SpaceType): boolean { return canCreateSpace(this.workspace.accountQuota(), purpose); }

  name = '';
  spaceType: SpaceType | null = null;
  saving = false;
  error = '';
  private catalogRequested = false;

  constructor() {
    if (this.catalog()) {
      this.syncSelectedCurrency();
    }
    effect(() => {
      if (this.showExtraSpaceOffer()) {
        if (!this.catalog() && !this.catalogRequested) {
          this.catalogRequested = true;
          this.loadCatalog(false);
        } else {
          this.syncSelectedCurrency();
        }
      } else {
        this.confirmedIntent.set(null);
        this.extraSpaceError.set('');
      }
    });
  }

  openExtraSpaceFlow(): void {
    if (this.saving) return;
    this.userRequestedExtraSpace.set(true);
    this.extraSpaceError.set('');
  }

  returnToCreateFlow(): void {
    if (this.submittingExtraSpace() || this.forcedExtraSpace() || this.quotaExhausted()) return;
    this.userRequestedExtraSpace.set(false);
    this.extraSpaceError.set('');
  }

  loadCatalog(forceRefresh: boolean): void {
    this.loadingCatalog.set(true);
    this.catalogError.set('');
    this.subscriptions.getCatalog(forceRefresh).pipe(
      finalize(() => {
        this.loadingCatalog.set(false);
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.syncSelectedCurrency();
      },
      error: (error: unknown) => {
        this.catalogError.set(extractApiErrorMessage(error, 'No se pudo cargar el catálogo oficial de tarifas.'));
      },
    });
  }

  selectCurrency(currency: SubscriptionCurrency): void {
    const normalized = currency.trim().toUpperCase();
    if (normalized !== 'PEN' || normalized === this.selectedCurrency() || this.submittingExtraSpace()) return;
    this.selectedCurrency.set(normalized);
    this.extraSpaceError.set('');
    this.confirmedIntent.set(null);
    // Parameters changed: generate a fresh idempotency key.
    this.idempotencyKey.set(generateIdempotencyKey());
  }

  onQuantityChange(raw: unknown): void {
    const parsed = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
    const next = Number.isFinite(parsed) ? parsed : NaN;
    if (next === this.quantityInput()) return;
    this.quantityInput.set(next);
    this.extraSpaceError.set('');
    this.confirmedIntent.set(null);
    // Parameters changed: generate a fresh idempotency key.
    this.idempotencyKey.set(generateIdempotencyKey());
  }

  acquireExtraSpace(): void {
    const price = this.selectedPrice();
    if (this.saving || this.submittingExtraSpace() || !this.showExtraSpaceOffer() || !price || !this.validQuantity()) return;

    this.submittingExtraSpace.set(true);
    this.extraSpaceError.set('');
    this.dialogRef.disableClose = true;

    this.subscriptions.createExtraSpaceRequest({
      currency: price.currency,
      quantity: this.quantityInput(),
      idempotency_key: this.idempotencyKey(),
    }).pipe(
      finalize(() => {
        this.submittingExtraSpace.set(false);
        this.dialogRef.disableClose = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (intent) => {
        // Preparatory mode: NEVER increment extra_spaces_allowance locally.
        this.confirmedIntent.set(intent);
        this.subscriptions.getRequests(20, 0).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
      },
      error: (error: unknown) => this.handleExtraSpaceError(error),
    });
  }

  startAnotherExtraSpaceRequest(): void {
    if (this.submittingExtraSpace()) return;
    this.confirmedIntent.set(null);
    this.extraSpaceError.set('');
    this.idempotencyKey.set(generateIdempotencyKey());
  }

  closeWithOutcome(): void {
    if (this.saving || this.submittingExtraSpace()) return;
    const intent = this.confirmedIntent();
    this.dialogRef.close(intent ? { extraSpaceRequested: true, intent } : undefined);
  }

  submit(): void {
    const name = this.name.trim();
    const purpose = this.spaceType;
    if (!name || !purpose || this.saving || this.showExtraSpaceOffer() || !this.canCreate(purpose)) return;
    this.saving = true;
    this.error = '';
    this.dialogRef.disableClose = true;
    defer(() => this.workspace.createSpace(name, purpose)).pipe(
      finalize(() => {
        this.saving = false;
        this.dialogRef.disableClose = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => this.dialogRef.close(created),
      error: (error: unknown) => {
        this.error = workspaceErrorMessage(error, 'Unable to create this space. Please retry.');
        this.cdr.markForCheck();
      },
    });
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

  private handleExtraSpaceError(error: unknown): void {
    const detail = apiErrorDetail(error);
    if (error instanceof HttpErrorResponse && error.status === 409 && detail?.code === 'IDEMPOTENCY_CONFLICT') {
      this.idempotencyKey.set(generateIdempotencyKey());
      this.extraSpaceError.set(detail.message || 'Los parámetros cambiaron. Se renovó la clave de idempotencia; vuelve a enviar tu solicitud.');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 422 && detail?.code === 'CURRENCY_UNAVAILABLE') {
      this.idempotencyKey.set(generateIdempotencyKey());
      this.extraSpaceError.set(detail.message || 'La moneda elegida no está disponible. Actualizamos las opciones del catálogo.');
      this.loadCatalog(true);
      return;
    }
    // Network/timeout/5xx error: keep the exact same idempotency_key so retries are deduplicated.
    this.extraSpaceError.set(extractApiErrorMessage(error, 'No pudimos registrar la solicitud. Puedes reintentar de forma segura sin duplicarla.'));
  }
}
