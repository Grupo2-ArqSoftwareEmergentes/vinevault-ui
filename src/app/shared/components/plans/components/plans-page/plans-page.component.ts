import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, finalize, take } from 'rxjs';
import { HeaderComponent } from '../../../header/header';
import { SidebarComponent } from '../../../sidebar/sidebar';
import { WorkspaceAccessService } from '../../../../services/workspace-access.service';
import { WorkspaceContextService } from '../../../../services/workspace-context.service';
import { ManagementBackLinkComponent } from '../../../management-back-link/management-back-link';
import { ProUpgradeDialogComponent, ProUpgradeDialogResult } from '../pro-upgrade-dialog/pro-upgrade-dialog';
import { CreateSpaceDialogComponent } from '../../../create-space-dialog/create-space-dialog';
import { proBenefits } from '../pro-benefits';
import { ResourceQuota } from '../../../../models/workspace-context';
import { SubscriptionApiService } from '../../../../services/subscription-api.service';
import {
  SubscriptionCatalog,
  SubscriptionOverview,
  SubscriptionRequestRecord,
  SubscriptionRequestsPage,
  findCatalogAddon,
  findCatalogPlan,
  formatQuotedMonthly,
  formatSubscriptionMoney,
} from '../../../../models/subscription';
import { extractApiErrorMessage } from '../../../../../device/interfaces/rest/transform/extract-api-error-message.transform';

@Component({
  selector: 'app-plans-page', standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, ManagementBackLinkComponent],
  templateUrl: './plans-page.component.html', styleUrl: './plans-page.component.css',
})
export class PlansPageComponent {
  readonly access = inject(WorkspaceAccessService);
  readonly workspace = inject(WorkspaceContextService);
  private readonly subscriptions = inject(SubscriptionApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly catalog = signal<SubscriptionCatalog | null>(null);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal('');

  readonly overview = signal<SubscriptionOverview | null>(null);
  readonly overviewLoading = signal(false);
  readonly overviewError = signal('');

  readonly requestsPage = signal<SubscriptionRequestsPage | null>(null);
  readonly requestsLoading = signal(false);
  readonly requestsError = signal('');
  readonly requestsLimit = 20;

  readonly billingMode = computed(() => this.overview()?.billing_mode ?? this.catalog()?.billing_mode ?? 'PREPARATORY');
  readonly activeSpaceId = computed(() => this.workspace.selection().space?.id.value ?? this.access.space()?.id.value ?? null);
  readonly activeCellarId = computed(() => {
    const selection = this.workspace.selection();
    return selection.space && selection.cellar?.spaceId.value === selection.space.id.value ? selection.cellar.id.value : null;
  });
  readonly overviewSpace = computed(() => {
    const spaceId = this.activeSpaceId();
    const space = this.overview()?.space;
    return spaceId && space?.id === spaceId ? space : null;
  });
  readonly overviewCellar = computed(() => {
    const cellar = this.overview()?.cellar;
    if (!cellar) return null;
    return !this.activeSpaceId() || !cellar.space_id || cellar.space_id === this.activeSpaceId() ? cellar : null;
  });
  readonly currentPurpose = computed(() => this.overviewSpace()?.purpose ?? this.access.purpose());
  readonly currentPlan = computed(() => this.overviewSpace()?.subscription_plan ?? this.access.plan());
  readonly currentStatus = computed(() => this.overviewSpace()?.subscription_status ?? this.access.status());
  readonly currentRole = computed(() => this.overviewSpace()?.role ?? this.access.role());
  readonly currentQuotas = computed(() => this.overviewSpace()?.quotas ?? this.access.space()?.quotas);
  readonly accountQuota = computed(() => this.overview()?.account_quota ?? this.workspace.accountQuota() ?? null);
  readonly canManageSubscription = computed(() => this.overviewSpace()?.can_manage_subscription ?? this.access.canManageSubscription());
  readonly canAnalyze = computed(() => this.overviewSpace()?.can_analyze ?? this.access.canAnalyze());

  readonly freePlan = computed(() => findCatalogPlan(this.catalog(), this.currentPurpose(), 'FREE'));
  readonly proPlan = computed(() => findCatalogPlan(this.catalog(), this.currentPurpose(), 'PRO'));
  readonly extraSpaceAddon = computed(() => findCatalogAddon(this.catalog(), 'EXTRA_SPACE'));
  readonly courtesySpaces = computed(() => this.catalog()?.courtesy_spaces ?? null);
  readonly benefits = computed(() => proBenefits(this.currentPurpose(), this.proPlan()));
  readonly pendingUpgrade = computed(() =>
    this.subscriptions.findPendingUpgrade(this.requestsPage()?.items ?? [], this.activeSpaceId())
  );

  readonly formatMoney = formatSubscriptionMoney;
  readonly formatQuoted = formatQuotedMonthly;

  private overviewRequest?: Subscription;
  private requestsRequest?: Subscription;
  private lastOverviewKey: string | null = null;
  isSidebarOpen = window.innerWidth > 768;

  constructor() {
    this.loadCatalog();
    this.loadRequests(0);

    effect(() => {
      const spaceId = this.activeSpaceId();
      const cellarId = spaceId ? this.activeCellarId() : null;
      const key = `${spaceId ?? ''}:${cellarId ?? ''}`;
      if (key === this.lastOverviewKey) return;
      this.lastOverviewKey = key;
      this.loadOverview(spaceId, cellarId);
    });
  }

  get purposeName(): string {
    const purpose = this.currentPurpose();
    return purpose === 'BUSINESS' ? 'Business' : purpose === 'COLLECTOR' ? 'Collector' : 'Espacio';
  }

  quotaLabel(quota: ResourceQuota | undefined, unit: string, unlimited: string): string {
    if (!quota) return 'No disponible';
    return quota.limit === null ? `${quota.used} ${unit} · ${unlimited}` : `${quota.used} / ${quota.limit} ${unit}`;
  }

  limitLabel(limit: number | null | undefined, unit: string, unlimited: string): string {
    if (limit === undefined) return 'No disponible';
    return limit === null ? unlimited : `${limit} ${unit}`;
  }

  requestKindLabel(kind: string): string {
    if (kind === 'UPGRADE_PRO') return 'Upgrade a Pro';
    if (kind === 'EXTRA_SPACE') return 'Espacio adicional';
    return kind;
  }

  requestStatusLabel(status: string): string {
    if (status === 'PENDING_PAYMENT') return 'Pendiente de pago';
    if (status === 'COMPLETED') return 'Confirmada';
    if (status === 'CANCELLED') return 'Cancelada';
    if (status === 'EXPIRED') return 'Expirada';
    return status;
  }

  spaceNameFor(spaceId: string | null): string {
    if (!spaceId) return 'Nivel cuenta';
    const found = this.workspace.spaces().find((space) => space.id.value === spaceId);
    if (found) return found.name;
    if (this.access.space()?.id.value === spaceId) return this.access.space()!.name;
    return `Espacio ${spaceId}`;
  }

  loadCatalog(forceRefresh = false): void {
    this.catalogLoading.set(true);
    this.catalogError.set('');
    this.subscriptions.getCatalog(forceRefresh).pipe(
      finalize(() => this.catalogLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (catalog) => this.catalog.set(catalog),
      error: (error: unknown) => this.catalogError.set(extractApiErrorMessage(error, 'No se pudo cargar el catálogo oficial de planes.')),
    });
  }

  loadOverview(spaceId: string | null = this.activeSpaceId(), cellarId: string | null = spaceId ? this.activeCellarId() : null): void {
    this.overviewRequest?.unsubscribe();
    this.overviewLoading.set(true);
    this.overviewError.set('');
    // Never send cellar_id without space_id.
    this.overviewRequest = this.subscriptions.getOverview(spaceId, spaceId ? cellarId : null).pipe(
      finalize(() => this.overviewLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (overview) => this.overview.set(overview),
      error: (error: unknown) => this.overviewError.set(extractApiErrorMessage(error, 'No se pudo consultar el estado de suscripción.')),
    });
  }

  loadRequests(offset = this.requestsPage()?.offset ?? 0): void {
    this.requestsRequest?.unsubscribe();
    this.requestsLoading.set(true);
    this.requestsError.set('');
    this.requestsRequest = this.subscriptions.getRequests(this.requestsLimit, offset).pipe(
      finalize(() => this.requestsLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (page) => this.requestsPage.set(page),
      error: (error: unknown) => this.requestsError.set(extractApiErrorMessage(error, 'No se pudo cargar el historial de solicitudes.')),
    });
  }

  toggleSidebar(): void { this.isSidebarOpen = !this.isSidebarOpen; }
  closeSidebar(): void { this.isSidebarOpen = false; }

  showUpgrade(): void {
    const space = this.access.space();
    if (
      !space ||
      !this.canManageSubscription() ||
      !this.currentPurpose() ||
      this.currentPlan() !== 'FREE' ||
      !!this.pendingUpgrade() ||
      this.dialog.openDialogs.some((dialog) => dialog.componentInstance instanceof ProUpgradeDialogComponent)
    ) return;

    this.dialog.open<ProUpgradeDialogComponent, { spaceId: string; cellarId?: string | null; catalog?: SubscriptionCatalog | null }, ProUpgradeDialogResult | undefined>(ProUpgradeDialogComponent, {
      width: '768px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'device-management-dialog',
      ariaLabelledBy: 'pro-upgrade-title',
      ariaDescribedBy: 'pro-upgrade-description',
      data: { spaceId: space.id.value, cellarId: this.activeCellarId(), catalog: this.catalog() },
    }).afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.refreshContext) {
        this.workspace.refresh();
        this.loadOverview();
      }
      if (result?.submitted || result?.refreshRequests) {
        this.loadRequests(0);
      }
    });
  }

  openExtraSpaceRequest(): void {
    if (this.dialog.openDialogs.some((dialog) => dialog.componentInstance instanceof CreateSpaceDialogComponent)) return;
    this.dialog.open(CreateSpaceDialogComponent, {
      width: '800px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'device-management-dialog',
      ariaLabelledBy: 'create-space-title',
      data: { mode: 'extra-space' },
    }).afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result: { extraSpaceRequested?: boolean } | undefined) => {
      if (result?.extraSpaceRequested) {
        this.loadRequests(0);
      }
    });
  }

  canGoPrevPage(): boolean {
    return (this.requestsPage()?.offset ?? 0) > 0;
  }

  canGoNextPage(): boolean {
    const page = this.requestsPage();
    return !!page && page.offset + page.items.length < page.total;
  }

  previousRequestsPage(): void {
    const page = this.requestsPage();
    if (!page || page.offset <= 0) return;
    this.loadRequests(Math.max(0, page.offset - page.limit));
  }

  nextRequestsPage(): void {
    const page = this.requestsPage();
    if (!page || !this.canGoNextPage()) return;
    this.loadRequests(page.offset + page.limit);
  }

  trackRequest(_index: number, item: SubscriptionRequestRecord): string {
    return item.id || `${item.kind}-${item.created_at}`;
  }
}
