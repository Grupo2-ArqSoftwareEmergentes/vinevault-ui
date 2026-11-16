import { Injectable, Injector } from '@angular/core';
import { Observable, of } from 'rxjs';
import { StorageService } from '../../../../core/services/storage/storage';
import { AuthStateService } from '../../../presentation/state/auth-state/auth-state';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';

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
    private storage: StorageService,
    private injector: Injector
  ) {}

  execute(): Observable<void> {
    this.storage.remove(LogoutUseCase.accessTokenKey);
    this.storage.remove(LogoutUseCase.legacyAccessTokenKey);
    this.storage.remove(LogoutUseCase.refreshTokenKey);
    this.storage.remove(LogoutUseCase.legacyRefreshTokenKey);
    this.authState.logout();
    this.injector.get(WorkspaceContextService).resetSession();
    return of(void 0);
  }
}
