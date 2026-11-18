import { DestroyRef, Injectable, Injector, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, Subscription, catchError, distinctUntilChanged, filter, finalize, map, of, shareReplay, switchMap, tap, take, takeUntil, throwError } from 'rxjs';
import { WineCellar } from '../../cava/domain/services/wine-cellar-query-service';
import { WineCellarQueryServiceImpl } from '../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellarCommandServiceImpl } from '../../cava/application/internal/commandservices/wine-cellar-command-service.impl';
import { AuthStateService } from '../../iam/presentation/state/auth-state/auth-state';
import { AccountQuota, CreatedWorkspace, WorkspaceCellar, WorkspaceDirectory, WorkspaceSpace } from '../models/workspace-context';
import { quotaErrorDetail } from './workspace-quota';
import { WorkspaceApiService, workspaceErrorMessage } from './workspace-api.service';
import { WorkspaceScopeService } from './workspace-scope.service';
import { SpaceType } from '../../device/domain/model/valueobjects/space-access';
import { StorageService } from '../../core/services/storage/storage';

export const WORKSPACE_SELECTION_STORAGE_KEY = 'vinevault.workspace-selection';
interface StoredWorkspaceSelection { spaceId: string; cellarId?: string | null; }

export interface WorkspaceSelection {
  space: WorkspaceSpace | null;
  cellar: WorkspaceCellar | null;
}

/** One context request feeds navigation; rich sensor metadata is fetched only when needed. */
@Injectable({ providedIn: 'root' })
export class WorkspaceContextService {
  private readonly api = inject(WorkspaceApiService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStateService);
  private readonly scope = inject(WorkspaceScopeService);
  private readonly storage = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;
  private readonly details = new Map<string, Observable<WineCellar | null>>();
  private readonly state = new BehaviorSubject<WorkspaceSelection>({ space: null, cellar: null });
  private readonly selectionState = signal(this.state.value);
  readonly selection = this.selectionState.asReadonly();
  readonly selectionChanges = this.state.asObservable();
  readonly spaces = signal<readonly WorkspaceSpace[]>([]);
  readonly cellars = signal<readonly WorkspaceCellar[]>([]);
  readonly accountQuota = signal<AccountQuota | undefined>(undefined);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  private readonly readiness = new BehaviorSubject<boolean | null>(null);
  private suppressUrlSelection = false;

  whenReady(): Observable<boolean> {
    this.ensureLoaded();
    return this.readiness.pipe(filter((value): value is boolean => value !== null), take(1));
  }

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      if (this.loaded()) this.applyUrlSelection();
    });
    const currentUser = this.auth.getCurrentState().user;
    let identity = currentUser?.id ?? currentUser?.email ?? currentUser?.username ?? null;
    this.auth.getState().pipe(map((state) => state.user?.id ?? state.user?.email ?? state.user?.username ?? null), distinctUntilChanged(), takeUntilDestroyed()).subscribe((next) => {
      if (next === identity) return;
      identity = next;
      this.reset();
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ensureLoaded(): void {
    if (!this.loaded() && !this.loading()) this.refresh();
  }

  refresh(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.readiness.next(null);
    this.error.set('');
    this.request = this.api.getContext().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (directory) => this.applyDirectory(directory),
      error: (error: unknown) => this.handleRefreshError(error),
    });
  }

  chooseSpace(spaceId: string, updateUrl = true): void {
    const space = this.spaces().find((item) => item.id.value === spaceId);
    if (!space) return;
    const currentCellarId = this.selection().cellar?.id.value;
    const cellars = this.cellars().filter((item) => item.spaceId.value === spaceId);
    const cellar = cellars.find((item) => item.id.value === currentCellarId) ?? cellars[0] ?? null;
    this.publish(space, cellar);
    if (updateUrl) this.writeUrl();
  }

  chooseCellar(cellarId: string, updateUrl = true): void {
    const cellar = this.cellars().find((item) => item.id.value === cellarId);
    const space = this.spaces().find((item) => item.id.value === cellar?.spaceId.value);
    if (!space || !cellar) return;
    this.publish(space, cellar);
    if (updateUrl) this.writeUrl();
  }

  adoptSpace(space: WorkspaceSpace): void {
    this.publish(space, this.selection().space?.id.value === space.id.value ? this.selection().cellar : null);
  }

  updateSpace(space: WorkspaceSpace): void {
    this.spaces.update((items) => items.map((item) => item.id.value === space.id.value ? space : item));
    if (this.selection().space?.id.value === space.id.value) this.adoptSpace(space);
    this.refresh();
  }

  removeSpace(spaceId: string): void {
    for (const cellar of this.cellars()) {
      if (cellar.spaceId.value === spaceId) this.details.delete(`${spaceId}:${cellar.id.value}`);
    }
    this.spaces.update((spaces) => spaces.filter((space) => space.id.value !== spaceId));
    this.cellars.update((cellars) => cellars.filter((cellar) => cellar.spaceId.value !== spaceId));
    if (this.selection().space?.id.value === spaceId) { this.publish(null, null); this.writeUrl(); }
    this.refresh();
  }

  updateCellars(spaceId: string, cellars: readonly WineCellar[]): void {
    for (const cellar of cellars) this.details.set(`${spaceId}:${cellar.id.value}`, of(cellar));
    this.cellars.update((items) => [...items.filter((item) => item.spaceId.value !== spaceId), ...cellars]);
    const current = this.selection();
    if (current.space?.id.value === spaceId && current.cellar) {
      this.publish(current.space, cellars.find((item) => item.id.value === current.cellar?.id.value) ?? null);
    }
  }

  upsertCellar(cellar: WineCellar, select = false, refreshContext = false): void {
    this.details.set(`${cellar.spaceId.value}:${cellar.id.value}`, of(cellar));
    this.cellars.update((items) => [...items.filter((item) => item.id.value !== cellar.id.value), cellar]);
    if (select) this.chooseCellar(cellar.id.value);
    else if (this.selection().cellar?.id.value === cellar.id.value) this.chooseCellar(cellar.id.value, false);
    if (refreshContext) this.refresh();
  }

  removeCellar(cellarId: string): void {
    const removed = this.cellars().find((cellar) => cellar.id.value === cellarId);
    if (removed) this.details.delete(`${removed.spaceId.value}:${cellarId}`);
    this.cellars.update((items) => items.filter((item) => item.id.value !== cellarId));
    if (this.selection().cellar?.id.value === cellarId) { this.publish(this.selection().space, null); this.writeUrl(); }
    this.refresh();
  }

  getCellarDetails(cellarId: string): Observable<WineCellar | null> {
    const cellar = this.cellars().find((item) => item.id.value === cellarId);
    if (!cellar) return of(null);
    const key = `${cellar.spaceId.value}:${cellarId}`;
    const cached = this.details.get(key);
    if (cached) return cached;
    const request = this.injector.get(WineCellarQueryServiceImpl).getWineCellarsBySpace(cellar.spaceId.value).pipe(
      map((items) => items.find((item) => item.id.value === cellarId) ?? null),
      takeUntil(this.scope.changed),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.details.set(key, request);
    return request;
  }

  createSpace(name: string, spaceType: SpaceType = 'COLLECTOR'): Observable<CreatedWorkspace> {
    return this.registerCreated(this.api.createSpace(name, spaceType));
  }

  onboard(name: string, spaceType: SpaceType, updateUrl = true): Observable<CreatedWorkspace> {
    return this.registerCreated(this.api.onboard(name, spaceType), updateUrl);
  }

  private registerCreated(request: Observable<CreatedWorkspace>, updateUrl = true): Observable<CreatedWorkspace> {
    const register = ({ space, cellar }: CreatedWorkspace) => {
      this.spaces.update((items) => [...items.filter((item) => item.id.value !== space.id.value), space]);
      this.cellars.update((items) => [...items.filter((item) => item.id.value !== cellar.id.value), cellar]);
    };
    return request.pipe(
      tap(register),
      switchMap((created) => this.refreshAfterMutation().pipe(
        tap(() => {
          // Keep the committed POST result even if the refresh failed or returned stale data.
          // Use authoritative context metadata when available, not a pre-refresh plan.
          register({ space: this.spaces().find((space) => space.id.value === created.space.id.value) ?? created.space, cellar: created.cellar });
          this.chooseCellar(created.cellar.id.value, updateUrl);
        }),
        map(() => created)
      )),
      takeUntil(this.scope.sessionChanged)
    );
  }

  createCellar(name: string, spaceId: string): Observable<WineCellar> {
    if (!this.spaces().some((space) => space.id.value === spaceId)) throw new Error('Select a space first.');
    return this.injector.get(WineCellarCommandServiceImpl).createWineCellar(spaceId, { name: name.trim(), description: null }).pipe(
      tap((cellar) => this.upsertCellar(cellar)),
      switchMap((cellar) => this.refreshAfterMutation().pipe(tap(() => {
        this.details.set(`${cellar.spaceId.value}:${cellar.id.value}`, of(cellar));
        this.chooseCellar(cellar.id.value);
      }), map(() => cellar)))
    );
  }

  private refreshAfterMutation(): Observable<WorkspaceDirectory> {
    this.request?.unsubscribe();
    this.loading.set(true);
    return this.api.getContext().pipe(
      tap((directory) => this.applyDirectory(directory)),
      // A successful POST must not be retried just because refreshing the directory failed.
      catchError((error: unknown) => {
        this.handleRefreshError(error);
        if (error instanceof HttpErrorResponse && (error.status === 401 || (error.status === 403 && !quotaErrorDetail(error)))) return throwError(() => error);
        return of({ spaces: this.spaces(), cellars: this.cellars(), account_quota: this.accountQuota() });
      }),
      finalize(() => this.loading.set(false))
    );
  }

  private applyDirectory(directory: WorkspaceDirectory): void {
    this.spaces.set(directory.spaces);
    this.cellars.set(directory.cellars);
    this.accountQuota.set(directory.account_quota);
    this.details.clear();
    this.loaded.set(true);
    this.loading.set(false);
    this.error.set('');
    this.applyUrlSelection(true);
    this.readiness.next(true);
  }

  private handleRefreshError(error: unknown): void {
    if (error instanceof HttpErrorResponse && (error.status === 401 || (error.status === 403 && !quotaErrorDetail(error)))) this.reset();
    this.error.set(workspaceErrorMessage(error, 'Unable to load workspaces. Please retry.'));
    this.loading.set(false);
    this.readiness.next(false);
  }

  private reset(): void {
    this.request?.unsubscribe();
    this.spaces.set([]);
    this.cellars.set([]);
    this.accountQuota.set(undefined);
    this.details.clear();
    this.loaded.set(false);
    this.loading.set(false);
    this.error.set('');
    this.publish(null, null);
    this.scope.invalidateSession();
    this.readiness.next(null);
  }

  resetSession(): void { this.reset(); this.readiness.next(false); }

  clearSelection(): void {
    this.details.clear();
    this.publish(null, null);
    this.suppressUrlSelection = true;
    void this.writeUrl().finally(() => { this.suppressUrlSelection = false; });
  }

  accessRevoked(refresh = true): void {
    this.request?.unsubscribe();
    this.spaces.set([]);
    this.cellars.set([]);
    this.accountQuota.set(undefined);
    this.loaded.set(false);
    this.loading.set(false);
    this.error.set('You do not have permission to access this space.');
    this.readiness.next(false);
    this.clearSelection();
    if (refresh) this.refresh();
  }

  private applyUrlSelection(initialize = false): void {
    if (this.suppressUrlSelection) { this.publish(null, null); return; }
    const params = this.router.parseUrl(this.router.url).queryParams;
    const current = this.selection();
    const requestedCellar = params['wineCellarId'] ?? params['cellarId'];
    const hasSpace = Object.prototype.hasOwnProperty.call(params, 'spaceId');
    const cellar = this.cellars().find((item) => item.id.value === requestedCellar) ?? null;
    if (requestedCellar && !cellar) { this.publish(null, null); return; }
    // Explicit deep links take precedence and fail closed if invalid/mismatched.
    // Never silently open a different cellar's inventory for a stale URL.
    if (hasSpace || requestedCellar) {
      const spaceId = params['spaceId'] ?? cellar?.spaceId.value;
      const space = this.spaces().find(item => item.id.value === spaceId) ?? null;
      this.publish(space, requestedCellar
        ? (cellar?.spaceId.value === space?.id.value ? cellar : null)
        : this.cellars().find(item => item.spaceId.value === space?.id.value) ?? null);
      return;
    }
    const stored = initialize ? this.readStoredSelection() : null;
    const space = this.spaces().find(item => item.id.value === current.space?.id.value)
      ?? this.spaces().find(item => item.id.value === stored?.spaceId)
      ?? (initialize ? this.spaces()[0] : null) ?? null;
    const associated = this.cellars().filter(item => item.spaceId.value === space?.id.value);
    const selectedCellar = associated.find(item => item.id.value === current.cellar?.id.value)
      ?? associated.find(item => stored?.spaceId === space?.id.value && item.id.value === stored?.cellarId)
      ?? associated[0] ?? null;
    this.publish(space, selectedCellar);
  }

  private readStoredSelection(): StoredWorkspaceSelection | null {
    try {
      const value = this.storage.get<StoredWorkspaceSelection>(WORKSPACE_SELECTION_STORAGE_KEY);
      return value && typeof value.spaceId === 'string' ? value : null;
    } catch { return null; } // Disabled storage must not prevent loading the workspace.
  }

  private publish(space: WorkspaceSpace | null, cellar: WorkspaceCellar | null): void {
    try {
      if (space) this.storage.set(WORKSPACE_SELECTION_STORAGE_KEY, { spaceId: space.id.value, cellarId: cellar?.id.value ?? null });
      else this.storage.remove(WORKSPACE_SELECTION_STORAGE_KEY);
    } catch { /* Private browsing/storage failures leave reactive state fully usable. */ }
    const previous = this.selection();
    if (previous.space === space && previous.cellar === cellar) return;
    const next = { space, cellar };
    if (previous.space && (previous.space.id.value !== space?.id.value || previous.space.role !== space?.role || previous.space.subscriptionStatus !== space?.subscriptionStatus || previous.space.subscriptionPlan !== space?.subscriptionPlan)) this.details.clear();
    this.scope.activate(space);
    this.selectionState.set(next);
    this.state.next(next);
  }

  private writeUrl(): Promise<boolean> {
    let route = this.router.routerState.root;
    while (route.firstChild) route = route.firstChild;
    return this.router.navigate([], { relativeTo: route, queryParams: {
      spaceId: this.selection().space?.id.value ?? null, wineCellarId: this.selection().cellar?.id.value ?? null, cellarId: null, deviceId: null,
    }, queryParamsHandling: 'merge' });
  }
}
