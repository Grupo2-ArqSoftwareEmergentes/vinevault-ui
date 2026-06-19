import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { StorageService } from '../../../../core/services/storage/storage';
import { AuthStateService } from '../../../presentation/state/auth-state/auth-state';

@Injectable({
  providedIn: 'root',
})
export class LogoutUseCase {
  constructor(
    private authState: AuthStateService,
    private storage: StorageService
  ) {}

  execute(): Observable<void> {
    this.storage.remove('accessToken');
    this.authState.logout();
    return of(void 0);
  }
}
