import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { LoginComponent } from './login';
import { LoginUseCase } from '../../../domain/use-cases/login/login';
import { AuthStateService } from '../../state/auth-state/auth-state';
import { SignupIntentService } from '../../state/signup-intent/signup-intent';
import { RegistrationFlowService } from '../../state/signup-intent/registration-flow.service';

describe('Login', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: LoginUseCase, useValue: { execute: vi.fn(() => of({})) } },
        { provide: RegistrationFlowService, useValue: { finishPending: vi.fn(() => of({ space: { id: { value: 'space-1' } }, cellar: { id: { value: 'cellar-1' } } })) } },
      ],
    }).compileComponents();

    TestBed.inject(SignupIntentService).clear();
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  afterEach(() => TestBed.inject(SignupIntentService).clear());

  it('renders the login heading and credential autocomplete hints', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe("Iniciar sesión en VineVault");
    expect(element.querySelector('input[autocomplete="username"]')).toBeTruthy();
    expect(element.querySelector('input[autocomplete="current-password"]')).toBeTruthy();
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/onboarding/intent');
  });

  it('toggles password visibility with an accessible control', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector<HTMLButtonElement>('.password-toggle')!;
    const password = element.querySelector<HTMLInputElement>('[formControlName="password"]')!;

    expect(password.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Show password');
    toggle.click();
    await fixture.whenStable();
    expect(password.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
  });

  it('keeps login disabled until valid and during authentication', async () => {
    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    component.loginForm.setValue({ username: 'cellar-owner', password: 'secret123' });
    await fixture.whenStable();
    expect(submit.disabled).toBe(false);

    TestBed.inject(AuthStateService).setLoading(true);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain("Iniciando sesión");
  });

  it('announces authentication errors', () => {
    TestBed.inject(AuthStateService).setError('Invalid credentials');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Invalid credentials');
  });

  it('resumes a previously registered account straight into inventory without another registration', () => {
    const intent = TestBed.inject(SignupIntentService);
    intent.select('BUSINESS');
    intent.accountCreated('owner@example.com');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.loginForm.setValue({ username: 'owner@example.com', password: 'Cellar123!' });
    component.onSubmit();
    expect(TestBed.inject(RegistrationFlowService).finishPending).toHaveBeenCalledExactlyOnceWith('owner@example.com');
    expect(navigate).toHaveBeenCalledWith(['/inventory'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
  });
});
