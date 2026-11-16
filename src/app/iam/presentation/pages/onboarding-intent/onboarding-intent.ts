import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SignupIntentService } from '../../state/signup-intent/signup-intent';
import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';

@Component({
  selector: 'app-onboarding-intent', standalone: true, imports: [RouterLink],
  templateUrl: './onboarding-intent.html',
})
export class OnboardingIntentComponent {
  readonly intent = inject(SignupIntentService);
  private readonly router = inject(Router);
  choose(spaceType: SpaceType): void {
    this.intent.select(spaceType);
    void this.router.navigate(['/register']);
  }
}
