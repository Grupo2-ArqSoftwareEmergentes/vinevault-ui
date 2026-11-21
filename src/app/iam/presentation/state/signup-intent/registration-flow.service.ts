import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap, tap, throwError } from 'rxjs';
import { SignupIntentService } from './signup-intent';
import { RegisterUseCase } from '../../../domain/use-cases/register/register';
import { LoginUseCase } from '../../../domain/use-cases/login/login';
import { RegisterPayload } from '../../../domain/models/user';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { CreatedWorkspace } from '../../../../shared/models/workspace-context';

@Injectable({ providedIn: 'root' })
export class RegistrationFlowService {
  private readonly intent = inject(SignupIntentService);
  private readonly register = inject(RegisterUseCase);
  private readonly login = inject(LoginUseCase);
  private readonly workspace = inject(WorkspaceContextService);

  complete(payload: RegisterPayload): Observable<CreatedWorkspace> {
    if (!this.intent.spaceType()) return throwError(() => new Error('Choose Collector or Business before registering.'));
    // A failed login/setup must never repeat a committed account registration.
    const account: Observable<unknown> = this.intent.needsSetup(payload.email)
      ? of(null)
      : this.register.execute(payload).pipe(tap(() => this.intent.accountCreated(payload.email)));
    return account.pipe(
      switchMap(() => this.login.execute({ username: payload.email.trim(), password: payload.password }, { loadContext: false })),
      switchMap(() => this.prepareSpace())
    );
  }

  finishPending(email: string): Observable<CreatedWorkspace | null> {
    return this.intent.needsSetup(email) ? this.prepareSpace() : of(null);
  }

  private prepareSpace(): Observable<CreatedWorkspace> {
    // Always re-read after a failed/uncertain POST before offering a manual retry.
    this.workspace.refresh();
    return this.workspace.whenReady().pipe(switchMap((ready) => {
      if (!ready) return throwError(() => new Error('Your account is ready, but we could not load your spaces. Retry setup without registering again.'));
      const spaceType = this.intent.spaceType();
      if (!spaceType) return throwError(() => new Error('Choose a space purpose to continue.'));
      const spaces = this.workspace.spaces();
      if (spaces.length) {
        const space = spaces.find((item) => item.spaceType === spaceType) ?? spaces[0];
        const cellar = this.workspace.cellars().find((item) => item.spaceId.value === space.id.value);
        if (!cellar) return throwError(() => new Error('Your space exists, but its default cellar is not available. Please sign in again to refresh it.'));
        this.workspace.chooseCellar(cellar.id.value, false);
        return of({ space, cellar });
      }
      return this.workspace.onboard(spaceType === 'BUSINESS' ? 'Mi negocio' : 'Mi colección', spaceType, false);
    }), tap(() => this.intent.clear()));
  }
}
