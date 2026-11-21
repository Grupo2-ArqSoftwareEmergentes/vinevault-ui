import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { OnboardingIntentComponent } from './onboarding-intent';
import { SignupIntentService } from '../../state/signup-intent/signup-intent';
import { signupIntentGuard } from '../../../../core/guards/workspace/signup-intent-guard';

@Component({ standalone: true, template: '' })
class RegisterTestPage {}

describe('Pre-registration intent', () => {
  beforeEach(() => {
    sessionStorage.removeItem('vinevault_signup_intent');
    TestBed.configureTestingModule({ imports: [OnboardingIntentComponent], providers: [provideRouter([
      { path: 'onboarding/intent', component: OnboardingIntentComponent },
      { path: 'register', component: RegisterTestPage, canActivate: [signupIntentGuard] },
    ])] });
  });

  afterEach(() => sessionStorage.removeItem('vinevault_signup_intent'));

  for (const type of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`stores ${type} and opens registration directly from its accessible card`, async () => {
      const fixture = TestBed.createComponent(OnboardingIntentComponent);
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('¿Para qué vas a usar tu cava?');
      expect(fixture.nativeElement.querySelectorAll('button').length).toBe(2);
      expect(fixture.nativeElement.textContent.match(/Plan Free incluido/g)?.length).toBe(2);
      fixture.nativeElement.querySelector(`[data-intent="${type}"]`).click();
      await fixture.whenStable();
      expect(TestBed.inject(SignupIntentService).spaceType()).toBe(type);
      expect(TestBed.inject(Router).url).toBe('/register');
      expect(new SignupIntentService().spaceType()).toBe(type);
    });
  }

  it('redirects a direct registration URL to intent selection if no valid intent exists', async () => {
    await TestBed.inject(Router).navigateByUrl('/register');
    expect(TestBed.inject(Router).url).toBe('/onboarding/intent');
  });

  it('discards unknown stored purposes instead of defaulting silently to Collector', () => {
    sessionStorage.setItem('vinevault_signup_intent', '{"space_type":"ADMIN"}');
    const result = TestBed.runInInjectionContext(() => signupIntentGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect(result.toString()).toBe('/onboarding/intent');
  });
});
