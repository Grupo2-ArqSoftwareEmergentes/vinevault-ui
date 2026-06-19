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

  execute(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.authRepository.login(credentials).pipe(
      switchMap((response: AuthResponse) => {
        if (response.user) {
          return [response];
        }

        const token = response.accessToken ?? response.access_token ?? response.token;

        if (token) {
          this.storage.set('accessToken', token);
        }

        return this.authRepository.getCurrentUser().pipe(
          map((user) => ({ ...response, user }))
        );
      }),
      tap((response: AuthResponse) => {
        const token = response.accessToken ?? response.access_token ?? response.token;
        const refreshToken = response.refreshToken ?? response.refresh_token;

        if (token) {
          this.storage.set('accessToken', token);
        }

        if (refreshToken) {
          this.storage.set('refreshToken', refreshToken);
        }

        if (response.user) {
          this.authState.setAuthenticated(response.user);
        }
      })
    );
  }
}
