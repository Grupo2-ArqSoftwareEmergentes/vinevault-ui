import { DestroyRef, Injectable, Injector, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, map, of, tap } from 'rxjs';
import { API_CONFIG, apiUrl } from '../../api.config';
import {
  CreateExtraSpaceRequestPayload,
  CreatePlanChangeRequestPayload,
  SubscriptionCatalog,
  SubscriptionOverview,
  SubscriptionRequestRecord,
  SubscriptionRequestsPage,
  normalizeSubscriptionCatalog,
  normalizeSubscriptionOverview,
  normalizeSubscriptionRequest,
  normalizeSubscriptionRequestsPage,
  ActiveSubscription,
  normalizeActiveSubscription,
  isFulfilledSubscription,
} from '../models/subscription';
import { WorkspaceScopeService } from './workspace-scope.service';
import { WorkspaceContextService } from './workspace-context.service';
import { WorkspaceSpace } from '../models/workspace-context';

@Injectable({ providedIn: 'root' })
export class SubscriptionApiService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly scope = inject(WorkspaceScopeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly refreshError = signal('');

  private readonly catalogState = signal<SubscriptionCatalog | null>(null);
  private readonly overviewState = signal<SubscriptionOverview | null>(null);
  private readonly overviewScope = signal<WorkspaceSpace | null>(null);
  private overviewVersion = 0;
  private readonly requestsState = signal<SubscriptionRequestsPage | null>(null);

  readonly catalog = this.catalogState.asReadonly();
  readonly overview = this.overviewState.asReadonly();
  readonly scopedOverview = computed(() => this.overviewScope() === this.scope.space() ? this.overviewState() : null);
  readonly requests = this.requestsState.asReadonly();

  constructor() {
    this.scope.sessionChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  /** Root-owned synchronization: no component invents or persists entitlements. */
  connectWorkspace(): void {
    effect(onCleanup => {
      const space = this.scope.space();
      untracked(() => {
        if (!space || !this.http) return;
        const catalog = this.getCatalog().subscribe({ error: () => {} });
        const overview = this.getOverview(space.id.value).subscribe({ error: () => {} });
        onCleanup(() => { catalog.unsubscribe(); overview.unsubscribe(); });
      });
    });
  }

  reset(): void {
    this.overviewVersion++;
    this.overviewScope.set(null);
    this.catalogState.set(null);
    this.overviewState.set(null);
    this.requestsState.set(null);
    this.refreshError.set('');
  }

  private requireHttp(): HttpClient {
    if (!this.http) throw new Error('HttpClient is not provided.');
    return this.http;
  }

  getCatalog(forceRefresh = false): Observable<SubscriptionCatalog> {
    const cached = this.catalogState();
    if (cached && !forceRefresh) return of(cached);
    return this.requireHttp().get<unknown>(apiUrl(API_CONFIG.endpoints.subscriptionsCatalog)).pipe(
      map(normalizeSubscriptionCatalog),
      tap((catalog) => this.catalogState.set(catalog))
    );
  }

  /** Never send cellar_id without space_id (backend rejects with 422 SPACE_REQUIRED). */
  getOverview(spaceId?: string | null, cellarId?: string | null): Observable<SubscriptionOverview> {
    const version = ++this.overviewVersion;
    const scope = this.scope.space();
    let params = new HttpParams();
    const trimmedSpaceId = spaceId?.trim() || '';
    const trimmedCellarId = cellarId?.trim() || '';
    if (trimmedSpaceId) {
      params = params.set('space_id', trimmedSpaceId);
      if (trimmedCellarId) params = params.set('cellar_id', trimmedCellarId);
    }
    return this.requireHttp().get<unknown>(apiUrl(API_CONFIG.endpoints.subscriptionsOverview), { params }).pipe(
      map(normalizeSubscriptionOverview),
      tap((overview) => {
        if (version !== this.overviewVersion) return;
        this.overviewScope.set(scope);
        this.overviewState.set(overview); this.refreshError.set('');
      })
    );
  }

  getRequests(limit = 20, offset = 0): Observable<SubscriptionRequestsPage> {
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    const safeOffset = Math.max(0, Math.trunc(offset));
    const params = new HttpParams().set('limit', String(safeLimit)).set('offset', String(safeOffset));
    return this.requireHttp().get<unknown>(apiUrl(API_CONFIG.endpoints.subscriptionRequests), { params }).pipe(
      map((raw) => normalizeSubscriptionRequestsPage(raw, safeLimit, safeOffset)),
      tap((page) => this.requestsState.set(page))
    );
  }

  createPlanChangeRequest(payload: CreatePlanChangeRequestPayload): Observable<SubscriptionRequestRecord> {
    // Strictly send only documented fields; never send subscription_plan, unit_amount, or allowances.
    const body: CreatePlanChangeRequestPayload = {
      space_id: payload.space_id,
      cellar_id: payload.cellar_id ?? null,
      target_plan: 'PRO',
      currency: payload.currency.trim().toUpperCase(),
      idempotency_key: payload.idempotency_key,
      ...(payload.confirm_simulated_payment !== undefined ? { confirm_simulated_payment: payload.confirm_simulated_payment } : {}),
    };
    return this.requireHttp().post<unknown>(apiUrl(API_CONFIG.endpoints.subscriptionPlanChangeRequests), body).pipe(
      map(normalizeSubscriptionRequest),
      tap(intent => { if (isFulfilledSubscription(intent)) this.refreshState(payload.space_id, payload.cellar_id); })
    );
  }

  createExtraSpaceRequest(payload: CreateExtraSpaceRequestPayload): Observable<SubscriptionRequestRecord> {
    if (!Number.isInteger(payload.quantity) || payload.quantity < 1 || payload.quantity > 100) {
      throw new Error('La cantidad de espacios adicionales debe ser un número entero entre 1 y 100.');
    }
    // Strictly send only documented fields with JSON integer quantity.
    const body: CreateExtraSpaceRequestPayload = {
      currency: payload.currency.trim().toUpperCase(),
      quantity: payload.quantity,
      idempotency_key: payload.idempotency_key,
      ...(payload.confirm_simulated_payment !== undefined ? { confirm_simulated_payment: payload.confirm_simulated_payment } : {}),
    };
    return this.requireHttp().post<unknown>(apiUrl(API_CONFIG.endpoints.subscriptionExtraSpaceRequests), body).pipe(
      map(normalizeSubscriptionRequest),
      tap(intent => { if (isFulfilledSubscription(intent)) this.refreshState(); })
    );
  }

  /** Refresh real server state after writes; never mutate plans, allowances or amounts locally. */
  refreshState(spaceId: string | null = this.scope.space()?.id.value ?? null, cellarId: string | null = null): void {
    this.refreshError.set('');
    this.getOverview(spaceId, cellarId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.injector.get(WorkspaceContextService).refresh(),
      error: error => {
        if (error?.status === 401) return;
        this.refreshError.set('La operación se registró, pero no se pudo actualizar el estado. Actualiza la suscripción antes de repetirla.');
        this.injector.get(WorkspaceContextService).refresh();
      },
    });
  }

  cancelSubscription(subscriptionId: string): Observable<ActiveSubscription | null> {
    return this.requireHttp().post<unknown>(apiUrl(`/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`), {}).pipe(
      map(normalizeActiveSubscription), tap(() => this.refreshState())
    );
  }

}
