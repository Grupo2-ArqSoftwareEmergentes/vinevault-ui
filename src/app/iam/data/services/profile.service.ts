import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, defer, finalize, map, tap, catchError, throwError, shareReplay, takeUntil } from 'rxjs';
import { API_CONFIG, apiUrl } from '../../../api.config';
import { StorageService } from '../../../core/services/storage/storage';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AuthStateService } from '../../presentation/state/auth-state/auth-state';
import {
  ChangePasswordPayload,
  ChangePasswordResponse,
  UpdateProfilePayload,
  UserProfile,
  normalizePreferredLanguage,
} from '../../domain/models/profile';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly authState = inject(AuthStateService);
  private readonly storage = inject(StorageService);
  private readonly scope = inject(WorkspaceScopeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  private inFlight?: Observable<UserProfile>;
  private connected = false;

  private readonly profileState = signal<UserProfile | null>(null);

  readonly profile = this.profileState.asReadonly();
  readonly preferredLanguage = this.i18n.language;

  constructor() {
    this.scope.sessionChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.profileState.set(null);
    });
  }

  /** Called once by the root: login/account changes and stored-session reloads hydrate the preference. */
  connectAccount(): void {
    if (this.connected || !this.http) return;
    this.connected = true;
    let identity: string | number | null | undefined;
    let hydration: Subscription | undefined;
    this.authState.getState().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
      const next = state.user?.id ?? (this.storage.get('access_token') || this.storage.get('accessToken') ? 'stored-session' : null);
      if (next === identity) return;
      identity = next;
      if (this.authState.isHydratingProfile()) return;
      hydration?.unsubscribe();
      this.profileState.set(null);
      if (next !== null) queueMicrotask(() => {
        // Account observers invalidate the old workspace synchronously. Start the new
        // account read afterwards so that invalidation cannot cancel its own hydration.
        if (identity !== next || this.destroyRef.destroyed) return;
        hydration = this.getProfile().pipe(takeUntil(this.scope.sessionChanged), takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
      });
    });
  }

  private requireHttp(): HttpClient {
    if (!this.http) throw new Error('HttpClient is not provided.');
    return this.http;
  }

  getProfile(): Observable<UserProfile> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = defer(() => {
      const revision = this.i18n.revision;
      return this.requireHttp().get<UserProfile>(apiUrl(API_CONFIG.endpoints.profile)).pipe(
        map(raw => this.normalizeProfile(raw)), tap(profile => this.syncState(profile, revision)), takeUntil(this.scope.sessionChanged));
    }).pipe(finalize(() => { this.inFlight = undefined; }), shareReplay({ bufferSize: 1, refCount: true }));
    return this.inFlight;
  }

  updateProfile(payload: UpdateProfilePayload): Observable<UserProfile> {
    // Strictly send only defined non-null fields; backend forbids nulls, empty updates, and extra fields.
    const body: UpdateProfilePayload = {};
    if (typeof payload.username === 'string') body.username = payload.username.trim();
    if (typeof payload.email === 'string') body.email = payload.email.trim().toLowerCase();
    if (typeof payload.full_name === 'string') body.full_name = payload.full_name.trim();
    if (payload.preferred_language !== undefined) {
      body.preferred_language = normalizePreferredLanguage(payload.preferred_language);
    }
    if (!Object.keys(body).length) {
      throw new Error('No hay cambios pendientes para guardar.');
    }
    return defer(() => {
      const previous = this.i18n.language();
      if (body.preferred_language) this.i18n.setLanguage(body.preferred_language);
      const revision = this.i18n.revision;
      return this.requireHttp().patch<UserProfile>(apiUrl(API_CONFIG.endpoints.profile), body).pipe(
        map(raw => this.normalizeProfile(raw)), tap(profile => this.syncState(profile, revision)),
        catchError(error => {
          if (body.preferred_language && revision === this.i18n.revision) this.i18n.setLanguage(previous);
          return throwError(() => error);
        }), takeUntil(this.scope.sessionChanged));
    });
  }

  changePassword(payload: ChangePasswordPayload): Observable<ChangePasswordResponse> {
    // Strictly send only current_password and new_password (never confirm_password).
    const body: ChangePasswordPayload = {
      current_password: payload.current_password,
      new_password: payload.new_password,
    };
    return this.requireHttp().post<ChangePasswordResponse>(apiUrl(API_CONFIG.endpoints.profileChangePassword), body);
  }

  private normalizeProfile(raw: UserProfile): UserProfile {
    return {
      ...raw,
      full_name: raw.full_name ?? null,
      preferred_language: normalizePreferredLanguage(raw.preferred_language),
    };
  }

  private syncState(profile: UserProfile, revision: number): void {
    if (revision === this.i18n.revision) this.i18n.setLanguage(profile.preferred_language);
    else profile = { ...profile, preferred_language: this.i18n.language() };
    this.profileState.set(profile);
    this.authState.syncProfile({
      id: profile.id,
      username: profile.username,
      email: profile.email,
      full_name: profile.full_name,
      preferred_language: profile.preferred_language,
    });
  }

}
