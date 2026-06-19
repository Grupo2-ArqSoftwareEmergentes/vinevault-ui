import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../../../iam/presentation/state/auth-state/auth-state';
import { StorageService } from '../../services/storage/storage';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authState: AuthStateService,
    private storage: StorageService,
    private router: Router
  ) {}

  canActivate() {
    return this.authState.getState().pipe(
      take(1),
      map(state => {
        if (state.isAuthenticated || this.storage.get<string>('accessToken')) {
          return true;
        }
        this.router.navigate(['/login']);
        return false;
      })
    );
  }
}
