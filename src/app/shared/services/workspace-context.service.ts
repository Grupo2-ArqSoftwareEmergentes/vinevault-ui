import { DestroyRef, Injectable, Injector, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, Subscription, catchError, distinctUntilChanged, filter, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { WineCellar } from '../../cava/domain/services/wine-cellar-query-service';
import { WineCellarQueryServiceImpl } from '../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellarCommandServiceImpl } from '../../cava/application/internal/commandservices/wine-cellar-command-service.impl';
import { AuthStateService } from '../../iam/presentation/state/auth-state/auth-state';
import { WorkspaceCellar, WorkspaceDirectory, WorkspaceSpace } from '../models/workspace-context';
import { WorkspaceApiService, workspaceErrorMessage } from './workspace-api.service';

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
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;
  private readonly details = new Map<string, Observable<WineCellar | null>>();
  private readonly state = new BehaviorSubject<WorkspaceSelection>({ space: null, cellar: null });
  private readonly selectionState = signal(this.state.value);
  readonly selection = this.selectionState.asReadonly();
  readonly selectionChanges = this.state.asObservable();
  readonly spaces = signal<readonly WorkspaceSpace[]>([]);
  readonly cellars = signal<readonly WorkspaceCellar[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      if (this.loaded()) this.applyUrlSelection();
    });
    let identity = this.auth.getCurrentState().user?.username ?? null;
    this.auth.getState().pipe(map((state) => state.user?.username ?? null), distinctUntilChanged(), takeUntilDestroyed()).subscribe((next) => {
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
    this.error.set('');
    this.request = this.api.getContext().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (directory) => this.applyDirectory(directory),
      error: (error: unknown) => this.handleRefreshError(error),
    });
  }

  chooseSpace(spaceId: string, updateUrl = true): void {
    const space = this.spaces().find((item) => item.id.value === spaceId);
    if (!space) return;
    this.publish(space, null);
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
    this.spaces.update((spaces) => spaces.filter((space) => space.id.value !== spaceId));
    this.cellars.update((cellars) => cellars.filter((cellar) => cellar.spaceId.value !== spaceId));
    if (this.selection().space?.id.value === spaceId) { this.publish(null, null); this.writeUrl(); }
    this.refresh();
  }

  updateCellars(spaceId: string, cellars: readonly WineCellar[]): void {
    for (const cellar of cellars) this.details.set(cellar.id.value, of(cellar));
    this.cellars.update((items) => [...items.filter((item) => item.spaceId.value !== spaceId), ...cellars]);
    const current = this.selection();
    if (current.space?.id.value === spaceId && current.cellar) {
      this.publish(current.space, cellars.find((item) => item.id.value === current.cellar?.id.value) ?? null);
    }
  }

  upsertCellar(cellar: WineCellar, select = false, refreshContext = false): void {
    this.details.set(cellar.id.value, of(cellar));
    this.cellars.update((items) => [...items.filter((item) => item.id.value !== cellar.id.value), cellar]);
    if (select) this.chooseCellar(cellar.id.value);
    else if (this.selection().cellar?.id.value === cellar.id.value) this.chooseCellar(cellar.id.value, false);
    if (refreshContext) this.refresh();
  }

  removeCellar(cellarId: string): void {
    this.details.delete(cellarId);
    this.cellars.update((items) => items.filter((item) => item.id.value !== cellarId));
    if (this.selection().cellar?.id.value === cellarId) { this.publish(this.selection().space, null); this.writeUrl(); }
    this.refresh();
  }

  getCellarDetails(cellarId: string): Observable<WineCellar | null> {
    const cellar = this.cellars().find((item) => item.id.value === cellarId);
    if (!cellar) return of(null);
    const cached = this.details.get(cellarId);
    if (cached) return cached;
    const request = this.injector.get(WineCellarQueryServiceImpl).getWineCellarsBySpace(cellar.spaceId.value).pipe(
      map((items) => items.find((item) => item.id.value === cellarId) ?? null),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.details.set(cellarId, request);
    return request;
  }

  createSpace(name: string): Observable<WorkspaceSpace> {
    return this.api.createSpace(name).pipe(tap((space) => this.spaces.update((items) => [...items.filter((item) => item.id.value !== space.id.value), space])), switchMap((space) => this.refreshAfterMutation().pipe(
      tap(() => this.chooseSpace(space.id.value)), map(() => space)
    )));
  }

  createCellar(name: string, spaceId: string): Observable<WineCellar> {
    if (!this.spaces().some((space) => space.id.value === spaceId)) throw new Error('Select a space first.');
    return this.injector.get(WineCellarCommandServiceImpl).createWineCellar(spaceId, { name: name.trim(), description: null }).pipe(
      tap((cellar) => this.upsertCellar(cellar)),
      switchMap((cellar) => this.refreshAfterMutation().pipe(tap(() => {
        this.details.set(cellar.id.value, of(cellar));
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
        return of({ spaces: this.spaces(), cellars: this.cellars() });
      }),
      finalize(() => this.loading.set(false))
    );
  }

  private applyDirectory(directory: WorkspaceDirectory): void {
    this.spaces.set(directory.spaces);
    this.cellars.set(directory.cellars);
    this.details.clear();
    this.loaded.set(true);
    this.loading.set(false);
    this.error.set('');
    this.applyUrlSelection();
  }

  private handleRefreshError(error: unknown): void {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) this.reset();
    this.error.set(workspaceErrorMessage(error, 'Unable to load workspaces. Please retry.'));
    this.loading.set(false);
  }

  private reset(): void {
    this.request?.unsubscribe();
    this.spaces.set([]);
    this.cellars.set([]);
    this.details.clear();
    this.loaded.set(false);
    this.loading.set(false);
    this.error.set('');
    this.publish(null, null);
  }

  private applyUrlSelection(): void {
    const params = this.router.parseUrl(this.router.url).queryParams;
    const current = this.selection();
    const requestedCellar = params['wineCellarId'] ?? params['cellarId'];
    const hasSpace = Object.prototype.hasOwnProperty.call(params, 'spaceId');
    const cellarId = requestedCellar ?? (!hasSpace ? current.cellar?.id.value : null);
    const cellar = this.cellars().find((item) => item.id.value === cellarId) ?? null;
    if (requestedCellar && !cellar) { this.publish(null, null); return; }
    const spaceId = params['spaceId'] ?? (requestedCellar ? cellar?.spaceId.value : current.space?.id.value);
    // No implicit server-side/default organization or workspace creation.
    const space = spaceId ? this.spaces().find((item) => item.id.value === spaceId) ?? null : null;
    this.publish(space, cellar?.spaceId.value === space?.id.value ? cellar : null);
  }

  private publish(space: WorkspaceSpace | null, cellar: WorkspaceCellar | null): void {
    const previous = this.selection();
    if (previous.space === space && previous.cellar === cellar) return;
    const next = { space, cellar };
    this.selectionState.set(next);
    this.state.next(next);
  }

  private writeUrl(): void {
    let route = this.router.routerState.root;
    while (route.firstChild) route = route.firstChild;
    void this.router.navigate([], { relativeTo: route, queryParams: {
      spaceId: this.selection().space?.id.value ?? null, wineCellarId: this.selection().cellar?.id.value ?? null, cellarId: null, deviceId: null,
    }, queryParamsHandling: 'merge' });
  }
}
