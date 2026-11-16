import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SignupIntentService } from '../../../iam/presentation/state/signup-intent/signup-intent';

export const signupIntentGuard: CanActivateFn = () => inject(SignupIntentService).spaceType()
  ? true : inject(Router).parseUrl('/onboarding/intent');
