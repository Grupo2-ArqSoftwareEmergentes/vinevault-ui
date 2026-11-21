import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { vi } from 'vitest';

import { RegisterComponent } from './register';
import { RegistrationFlowService } from '../../state/signup-intent/registration-flow.service';
import { SignupIntentService } from '../../state/signup-intent/signup-intent';
import { AuthStateService } from '../../state/auth-state/auth-state';
import { NotificationService } from '../../../../core/services/notification/notification';

describe('Register', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: RegistrationFlowService, useValue: { complete: vi.fn(() => NEVER) } },
      ],
    }).compileComponents();

    TestBed.inject(SignupIntentService).select('COLLECTOR');
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  afterEach(() => TestBed.inject(SignupIntentService).clear());

  it('renders VineVault copy, legal links, and credential autocomplete hints', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe("Crear una cuenta");
    expect(element.textContent).toContain("Organiza y conserva tu colección de vinos");
    expect(element.textContent).toContain("Acepto los");
    expect(element.textContent).not.toContain('Clair');
    expect(element.querySelector('a[href="/terms"]')).toBeTruthy();
    expect(element.querySelector('a[href="/privacy"]')).toBeTruthy();
    expect(element.querySelector('a[href="/login"]')).toBeTruthy();
    expect(element.querySelector('input[autocomplete="name"]')).toBeTruthy();
    expect(element.querySelector('input[autocomplete="email"]')).toBeTruthy();
    expect(element.querySelectorAll('input[autocomplete="new-password"]').length).toBe(2);
  });

  it('toggles password and confirmation visibility independently', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const toggles = element.querySelectorAll<HTMLButtonElement>('.password-toggle');
    const password = element.querySelector<HTMLInputElement>('[formControlName="password"]')!;
    const confirmation = element.querySelector<HTMLInputElement>('[formControlName="confirmPassword"]')!;

    toggles[0].click();
    await fixture.whenStable();
    expect(password.type).toBe('text');
    expect(confirmation.type).toBe('password');
    expect(toggles[0].getAttribute('aria-label')).toBe('Hide password');

    toggles[1].click();
    await fixture.whenStable();
    expect(confirmation.type).toBe('text');
    expect(toggles[1].getAttribute('aria-label')).toBe('Hide confirmation password');
  });

  it('preserves password strength, matching, and terms validation', async () => {
    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    component.registerForm.setValue({
      full_name: 'Collector', email: 'collector@example.com',
      password: 'weak', confirmPassword: 'weak', acceptTerms: false,
    });
    expect(component.registerForm.get('password')?.invalid).toBe(true);

    component.registerForm.patchValue({ password: 'Cellar123!', confirmPassword: 'Different123!' });
    expect(component.registerForm.hasError('mismatch')).toBe(true);
    component.registerForm.patchValue({ confirmPassword: 'Cellar123!' });
    expect(component.registerForm.invalid).toBe(true);
    component.registerForm.patchValue({ acceptTerms: true });
    await fixture.whenStable();
    expect(submit.disabled).toBe(false);
  });

  it('submits the existing registration payload and displays loading state', () => {
    component.registerForm.setValue({
      full_name: 'Collector', email: 'collector@example.com',
      password: 'Cellar123!', confirmPassword: 'Cellar123!', acceptTerms: true,
    });
    component.onSubmit();
    expect(TestBed.inject(RegistrationFlowService).complete).toHaveBeenCalledWith({
      full_name: 'Collector', email: 'collector@example.com', password: 'Cellar123!',
    });
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain("Preparando tu espacio");
    TestBed.inject(AuthStateService).setLoading(false);
    component.onSubmit();
    expect(TestBed.inject(RegistrationFlowService).complete).toHaveBeenCalledOnce();
    expect(component.isLoading).toBe(true);
  });

  it('announces errors and retains the Google sign-up behavior', () => {
    TestBed.inject(AuthStateService).setError('Registration failed');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Registration failed');

    const feedback = vi.spyOn(fixture.debugElement.injector.get(NotificationService), 'show');
    fixture.nativeElement.querySelector('.google-button').click();
    expect(feedback).toHaveBeenCalledWith('Google sign-up is not available yet.', 'warning', 3000);
  });
});
