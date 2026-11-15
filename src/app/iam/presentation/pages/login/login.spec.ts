import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { LoginComponent } from './login';
import { LoginUseCase } from '../../../domain/use-cases/login/login';
import { AuthStateService } from '../../state/auth-state/auth-state';

describe('Login', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: LoginUseCase, useValue: { execute: vi.fn(() => of({})) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the login heading and credential autocomplete hints', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Login to VineVault');
    expect(element.querySelector('input[autocomplete="username"]')).toBeTruthy();
    expect(element.querySelector('input[autocomplete="current-password"]')).toBeTruthy();
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/register');
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
    expect(submit.textContent).toContain('Signing in');
  });

  it('announces authentication errors', () => {
    TestBed.inject(AuthStateService).setError('Invalid credentials');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Invalid credentials');
  });
});
