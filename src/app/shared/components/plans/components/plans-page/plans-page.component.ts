import { I18nModule } from '../../../../../core/i18n/i18n.module';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
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
import { ActiveSubscriptionsDialogComponent, ActiveSubscriptionsDialogData } from '../active-subscriptions-dialog/active-subscriptions-dialog';
import { ResourceQuota, WorkspaceSpace } from '../../../../models/workspace-context';
import { formatSolesMoney, formatSolesMonthly } from '../../../../models/subscription-summary';
import { subscriptionErrorMessage } from '../../../../models/subscription-error';
import { SubscriptionApiService } from '../../../../services/subscription-api.service';
import {
  SubscriptionCatalog,
  SubscriptionRequestRecord,
  SubscriptionRequestsPage,
  findCatalogAddon,
  findCatalogPlan,
  ActiveSubscription,
  isFulfilledSubscription,
} from '../../../../models/subscription';
import { extractApiErrorMessage } from '../../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { NotificationService } from '../../../../../core/services/notification/notification';
import { I18nService } from '../../../../../core/i18n/i18n.service';

@Component({
  selector: 'app-plans-page', standalone: true,
  imports: [I18nModule, CommonModule, HeaderComponent, SidebarComponent, ManagementBackLinkComponent],
  templateUrl: './plans-page.component.html', styleUrl: './plans-page.component.css',
})
export class PlansPageComponent {
  @ViewChild('activeSubscriptionsTrigger') private readonly activeSubscriptionsTrigger?: ElementRef<HTMLButtonElement>;
  readonly access = inject(WorkspaceAccessService);
  readonly workspace = inject(WorkspaceContextService);
  private readonly subscriptions = inject(SubscriptionApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);

  readonly catalog = signal<SubscriptionCatalog | null>(null);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal('');

  readonly overview = this.subscriptions.overview;
  readonly overviewLoading = signal(false);
  readonly overviewError = signal('');

  readonly requestsPage = signal<SubscriptionRequestsPage | null>(null);
  readonly requestsLoading = signal(false);
  readonly requestsError = signal('');
  readonly requestsLimit = 20;

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
  readonly currentPurpose = computed(() => this.overviewSpace()?.purpose ?? this.access.purpose());
  readonly currentPlan = computed(() => this.overviewSpace()?.subscription_plan ?? this.access.plan());
  readonly accountQuota = computed(() => this.overview()?.account_quota ?? this.workspace.accountQuota() ?? null);
  readonly canManageSubscription = computed(() => this.overviewSpace()?.can_manage_subscription === true);
  readonly extraSpaceAddon = computed(() => findCatalogAddon(this.catalog(), 'EXTRA_SPACE'));

  readonly formatMoney = formatSolesMoney;
  readonly formatQuoted = (amount: string | null | undefined, currency: string | null | undefined) => this.i18n.t(formatSolesMonthly(amount, currency ?? '').replace(' / mes', this.i18n.t(' / mes')));
  readonly extraSpacePrice = computed(() => this.extraSpaceAddon()?.prices.find(price => price.currency === 'PEN') ?? null);
  readonly managedSpaceId = signal<string | null>(null);
  readonly allSpaces = computed<readonly WorkspaceSpace[]>(() => {
    const spaces = this.workspace.spaces();
    const selected = this.access.space();
    const overview = this.overviewSpace();
    return (spaces.length ? spaces : selected ? [selected] : []).map(space => overview?.id === space.id.value ? {
      ...space, spaceType: overview.purpose, subscriptionPlan: overview.subscription_plan,
      subscriptionStatus: overview.subscription_status, quotas: overview.quotas,
    } : space);
  });
  readonly billing = computed(() => this.overviewLoading() || this.overviewError() ? null : this.overview()?.billing ?? null);
  readonly activeSubscriptions = computed(() => this.billing()?.active_subscriptions.filter(item => item.status === 'ACTIVE') ?? []);
  readonly activeSubscriptionsDialogOpen = signal(false);
  readonly refreshError = this.subscriptions.refreshError;
  readonly cancellingIds = signal<ReadonlySet<string>>(new Set());
  readonly cancellationSubmitted = signal<ReadonlySet<string>>(new Set());
  readonly monthlySummary = computed(() => {
    const quota = this.accountQuota();
    return { extra: quota?.extra_spaces_allowance, included: quota ? quota.max_spaces - quota.extra_spaces_allowance : null };
  });

  recurringCost(space: WorkspaceSpace): string {
    const subscription = this.activeSubscriptions().find(s => s.kind === 'UPGRADE_PRO' && s.space_id === space.id.value);
    return subscription ? this.formatQuoted(subscription.monthly_amount, subscription.currency) : this.i18n.t('Sin importe activo disponible');
  }
  validityLabel(space: WorkspaceSpace): string {
    const active = this.activeSubscriptions().find(s => s.kind === 'UPGRADE_PRO' && s.space_id === space.id.value);
    if (active?.access_until) return this.i18n.t('Activo hasta {date}', { date: this.dateLabel(active.access_until) });
    const date = space.subscriptionExpiresAt ? new Date(space.subscriptionExpiresAt) : null;
    if (date && !Number.isNaN(date.getTime())) return this.i18n.t(space.subscriptionStatus === 'EXPIRED' ? 'Expiró {date}' : 'Hasta {date}', { date: this.i18n.date(date) });
    return space.subscriptionPlan === 'FREE' ? 'Sin vencimiento' : 'Fecha no disponible';
  }
  proPrice(space: WorkspaceSpace): string {
    const prices = findCatalogPlan(this.catalog(), space.spaceType, 'PRO')?.prices;
    const price = prices?.find(p => p.currency === 'PEN');
    return price ? this.formatMoney(price.amount, price.currency) : 'Tarifa no disponible';
  }
  canManageSpace(space: WorkspaceSpace): boolean {
    if (space.role !== 'OWNER') return false;
    const overview = this.overviewSpace();
    return overview?.id === space.id.value && overview.can_manage_subscription;
  }
  canOpenManagement(space: WorkspaceSpace): boolean {
    return space.role === 'OWNER' && (space.id.value !== this.activeSpaceId() || this.canManageSpace(space));
  }
  manageSpace(space: WorkspaceSpace): void {
    if (space.role !== 'OWNER') return;
    if (this.workspace.spaces().some(s => s.id.value === space.id.value)) this.workspace.chooseSpace(space.id.value);
    this.managedSpaceId.set(this.managedSpaceId() === space.id.value ? null : space.id.value);
  }
  upgradeSpace(space: WorkspaceSpace): void {
    if (space.role !== 'OWNER' || space.subscriptionPlan !== 'FREE') return;
    const previousId = this.activeSpaceId();
    this.upgradeRequestedFor = space.id.value;
    if (this.workspace.spaces().some(s => s.id.value === space.id.value)) this.workspace.chooseSpace(space.id.value);
    if (this.activeSpaceId() !== space.id.value || previousId !== space.id.value) return;
    if (this.overviewSpace()?.id === space.id.value && this.canManageSubscription()) { this.upgradeRequestedFor = null; this.showUpgrade(); }
    else this.loadOverview(space.id.value, this.activeCellarId(), true);
  }

  dateLabel(date: string | null): string {
    if (!date || Number.isNaN(new Date(date).getTime())) return 'Fecha no disponible';
    return this.i18n.date(date);
  }

  canCancel(item: ActiveSubscription): boolean {
    if (!this.activeSubscriptions().some(s => s.id === item.id) || item.status !== 'ACTIVE' || !item.auto_renews || item.cancel_at_period_end || this.cancellationSubmitted().has(item.id)) return false;
    // Account-level subscriptions in billing belong to the authenticated purchaser.
    if (item.kind === 'EXTRA_SPACE') return true;
    return item.kind === 'UPGRADE_PRO' && this.access.space()?.role === 'OWNER' && item.space_id === this.overviewSpace()?.id && this.overviewSpace()?.can_manage_subscription === true;
  }

  cancel(item: ActiveSubscription): void {
    if (!this.canCancel(item) || this.cancellingIds().has(item.id)) return;
    this.cancellingIds.update(ids => new Set([...ids, item.id]));
    this.subscriptions.cancelSubscription(item.id).pipe(finalize(() => {
      this.cancellingIds.update(ids => { const next = new Set(ids); next.delete(item.id); return next; });
    }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.cancellationSubmitted.update(ids => new Set([...ids, item.id]));
        this.notifications.success('Renovación cancelada. Los beneficios se conservan hasta el fin del ciclo confirmado por el servidor.');
      },
      error: error => { this.notifications.error(subscriptionErrorMessage(error)); if (error?.error?.detail?.code === 'SUBSCRIPTION_EXPIRED') this.subscriptions.refreshState(); },
    });
  }

  openActiveSubscriptions(): void {
    if (this.activeSubscriptionsDialogOpen() || this.dialog.openDialogs.length) return;
    this.activeSubscriptionsTrigger?.nativeElement.focus();
    this.activeSubscriptionsDialogOpen.set(true);
    const ref = this.dialog.open<ActiveSubscriptionsDialogComponent, ActiveSubscriptionsDialogData>(ActiveSubscriptionsDialogComponent, {
      width: '680px', maxWidth: 'calc(100vw - 32px)', panelClass: 'device-management-dialog',
      ariaLabelledBy: 'active-subscriptions-title',
      data: {
        items: this.activeSubscriptions, loading: this.overviewLoading, available: computed(() => !!this.billing()),
        error: computed(() => this.overviewError() || this.refreshError()),
        cancellingIds: this.cancellingIds, spaceId: this.activeSpaceId,
        spaceName: id => this.spaceNameFor(id), dateLabel: date => this.dateLabel(date),
        canCancel: item => this.canCancel(item), cancel: item => this.cancel(item), retry: () => this.loadOverview(),
      },
    });
    const unregisterClose = this.destroyRef.onDestroy(() => ref.close());
    ref.afterClosed().pipe(take(1), finalize(() => {
      unregisterClose(); this.activeSubscriptionsDialogOpen.set(false);
    }), takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  private overviewRequest?: Subscription;
  private requestsRequest?: Subscription;
  private lastOverviewKey: string | null = null;
  private upgradeRequestedFor: string | null = null;
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

  quotaLabel(quota: ResourceQuota | undefined, unit: string, unlimited: string): string {
    if (!quota) return 'No disponible';
    return quota.limit === null ? `${quota.used} ${this.i18n.t(unit)} · ${this.i18n.t(unlimited)}` : `${quota.used} / ${quota.limit} ${this.i18n.t(unit)}`;
  }

  requestKindLabel(kind: string): string {
    if (kind === 'UPGRADE_PRO') return 'Upgrade a Pro';
    if (kind === 'EXTRA_SPACE') return 'Espacio adicional';
    return kind;
  }

  requestStatusLabel(status: string): string {
    if (status === 'PENDING_PAYMENT') return 'Pendiente de pago';
    if (status === 'COMPLETED') return 'Confirmada';
    if (status === 'FULFILLED') return 'Confirmada · Pago simulado';
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

  loadOverview(spaceId: string | null = this.activeSpaceId(), cellarId: string | null = spaceId ? this.activeCellarId() : null, openUpgrade = false): void {
    this.overviewRequest?.unsubscribe();
    this.overviewLoading.set(true);
    this.overviewError.set('');
    // Never send cellar_id without space_id.
    this.overviewRequest = this.subscriptions.getOverview(spaceId, spaceId ? cellarId : null).pipe(
      finalize(() => this.overviewLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => { if (openUpgrade || this.upgradeRequestedFor === spaceId) { this.upgradeRequestedFor = null; this.showUpgrade(); } },
      error: (error: unknown) => this.overviewError.set(subscriptionErrorMessage(error)),
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
      space.role !== 'OWNER' ||
      !this.access.canManageSubscription() ||
      !this.canManageSubscription() ||
      !this.currentPurpose() ||
      this.currentPlan() !== 'FREE' ||
      this.dialog.openDialogs.some((dialog) => dialog.componentInstance instanceof ProUpgradeDialogComponent || dialog.componentInstance instanceof ActiveSubscriptionsDialogComponent)
    ) return;

    this.dialog.open<ProUpgradeDialogComponent, { spaceId: string; cellarId?: string | null; catalog?: SubscriptionCatalog | null }, ProUpgradeDialogResult | undefined>(ProUpgradeDialogComponent, {
      width: '900px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'device-management-dialog',
      ariaLabelledBy: 'pro-upgrade-title',
      ariaDescribedBy: 'pro-upgrade-description',
      data: { spaceId: space.id.value, cellarId: this.activeCellarId(), catalog: this.catalog() },
    }).afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.intent) this.notifications.show(isFulfilledSubscription(result.intent) ? 'Pago de prueba aprobado. Activación confirmada por el servidor; sin cobro real.' : 'Solicitud pendiente de pago; no se han activado beneficios.', isFulfilledSubscription(result.intent) ? 'success' : 'info');
      if (result?.refreshContext) {
        this.subscriptions.refreshState();
      }
      if (result?.submitted || result?.refreshRequests) {
        this.loadRequests(0);
      }
    });
  }

  openExtraSpaceRequest(): void {
    if (this.dialog.openDialogs.some((dialog) => dialog.componentInstance instanceof CreateSpaceDialogComponent || dialog.componentInstance instanceof ActiveSubscriptionsDialogComponent)) return;
    this.dialog.open(CreateSpaceDialogComponent, {
      width: '900px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'device-management-dialog',
      ariaLabelledBy: 'create-space-title',
      data: { mode: 'extra-space' },
    }).afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result: { extraSpaceRequested?: boolean; activated?: boolean } | undefined) => {
      if (result?.extraSpaceRequested) {
        this.notifications.show(result.activated ? 'Activación simulada confirmada. Sin cobro real.' : 'Solicitud registrada. Pendiente de pago.', result.activated ? 'success' : 'info');
        this.loadRequests(0);
      }
    });
  }

  canGoPrevPage(): boolean {
    return (this.requestsPage()?.offset ?? 0) > 0;
  }

  canGoNextPage(): boolean {
    const page = this.requestsPage();
    if (page?.has_more !== undefined) return page.has_more;
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
