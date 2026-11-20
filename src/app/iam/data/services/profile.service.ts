import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, map, tap } from 'rxjs';
import { API_CONFIG, apiUrl } from '../../../api.config';
import { StorageService } from '../../../core/services/storage/storage';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { AuthStateService } from '../../presentation/state/auth-state/auth-state';
import {
  ChangePasswordPayload,
  ChangePasswordResponse,
  PREFERRED_LANGUAGE_STORAGE_KEY,
  PreferredLanguage,
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

  private readonly profileState = signal<UserProfile | null>(null);
  private readonly preferredLanguageState = signal<PreferredLanguage>(this.readStoredLanguage());

  readonly profile = this.profileState.asReadonly();
  readonly preferredLanguage = this.preferredLanguageState.asReadonly();

  constructor() {
    this.applyDocumentLanguage(this.preferredLanguageState());
    this.scope.sessionChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.profileState.set(null);
    });
  }

  private requireHttp(): HttpClient {
    if (!this.http) throw new Error('HttpClient is not provided.');
    return this.http;
  }

  getProfile(): Observable<UserProfile> {
    return this.requireHttp().get<UserProfile>(apiUrl(API_CONFIG.endpoints.profile)).pipe(
      map((raw) => this.normalizeProfile(raw)),
      tap((profile) => this.syncState(profile))
    );
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
    return this.requireHttp().patch<UserProfile>(apiUrl(API_CONFIG.endpoints.profile), body).pipe(
      map((raw) => this.normalizeProfile(raw)),
      tap((profile) => this.syncState(profile))
    );
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

  private syncState(profile: UserProfile): void {
    this.profileState.set(profile);
    this.persistLanguage(profile.preferred_language);
    this.authState.syncProfile({
      id: profile.id,
      username: profile.username,
      email: profile.email,
      full_name: profile.full_name,
      preferred_language: profile.preferred_language,
    });
  }

  private readStoredLanguage(): PreferredLanguage {
    try {
      const stored = this.storage.get<string>(PREFERRED_LANGUAGE_STORAGE_KEY);
      return normalizePreferredLanguage(stored);
    } catch {
      return 'es';
    }
  }

  private persistLanguage(language: PreferredLanguage): void {
    this.preferredLanguageState.set(language);
    this.applyDocumentLanguage(language);
    try {
      this.storage.set(PREFERRED_LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* Ignore storage failures in restricted browsing modes. */
    }
  }

  private applyDocumentLanguage(language: PreferredLanguage): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = language;
    }
  }
}
