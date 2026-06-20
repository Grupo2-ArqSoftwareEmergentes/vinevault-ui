import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { StorageService } from '../../../../core/services/storage/storage';
import { AuthStateService } from '../../../presentation/state/auth-state/auth-state';

@Injectable({
  providedIn: 'root',
})
export class LogoutUseCase {
  private static readonly accessTokenKey = 'access_token';
  private static readonly legacyAccessTokenKey = 'accessToken';
  private static readonly refreshTokenKey = 'refresh_token';
  private static readonly legacyRefreshTokenKey = 'refreshToken';

  constructor(
    private authState: AuthStateService,
    private storage: StorageService
  ) {}

  execute(): Observable<void> {
    this.storage.remove(LogoutUseCase.accessTokenKey);
    this.storage.remove(LogoutUseCase.legacyAccessTokenKey);
    this.storage.remove(LogoutUseCase.refreshTokenKey);
    this.storage.remove(LogoutUseCase.legacyRefreshTokenKey);
    this.authState.logout();
    return of(void 0);
  }
}
