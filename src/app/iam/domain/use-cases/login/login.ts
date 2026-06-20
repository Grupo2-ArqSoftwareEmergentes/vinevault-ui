import { Injectable } from '@angular/core';
import { map, Observable, switchMap, tap } from 'rxjs';
import { StorageService } from '../../../../core/services/storage/storage';
import { AuthRepository } from '../../../data/repositories/auth-repository/auth-repository';
import { AuthResponse, LoginCredentials } from '../../models/user';
import { AuthStateService } from '../../../presentation/state/auth-state/auth-state';

@Injectable({
  providedIn: 'root',
})
export class LoginUseCase {
  constructor(
    private authRepository: AuthRepository,
    private authState: AuthStateService,
    private storage: StorageService
  ) {}

  private static readonly accessTokenKey = 'access_token';
  private static readonly legacyAccessTokenKey = 'accessToken';
  private static readonly refreshTokenKey = 'refresh_token';
  private static readonly legacyRefreshTokenKey = 'refreshToken';

  execute(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.authRepository.login(credentials).pipe(
      switchMap((response: AuthResponse) => {
        if (response.user) {
          return [response];
        }

        const token = response.accessToken ?? response.access_token ?? response.token;

        if (token) {
          this.storage.set(LoginUseCase.accessTokenKey, token);
          this.storage.remove(LoginUseCase.legacyAccessTokenKey);
        }

        return this.authRepository.getCurrentUser().pipe(
          map((user) => ({ ...response, user }))
        );
      }),
      tap((response: AuthResponse) => {
        const token = response.accessToken ?? response.access_token ?? response.token;
        const refreshToken = response.refreshToken ?? response.refresh_token;

        if (token) {
          this.storage.set(LoginUseCase.accessTokenKey, token);
          this.storage.remove(LoginUseCase.legacyAccessTokenKey);
        }

        if (refreshToken) {
          this.storage.set(LoginUseCase.refreshTokenKey, refreshToken);
          this.storage.remove(LoginUseCase.legacyRefreshTokenKey);
        }

        if (response.user) {
          this.authState.setAuthenticated(response.user);
        }
      })
    );
  }
}
