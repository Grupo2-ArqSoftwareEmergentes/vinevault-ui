import { NotificationService } from '../../../../core/services/notification/notification';
import { I18nModule } from '../../../../core/i18n/i18n.module';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { RegistrationFlowService } from '../../state/signup-intent/registration-flow.service';
import { SignupIntentService } from '../../state/signup-intent/signup-intent';
import { AuthState, AuthStateService } from '../../state/auth-state/auth-state';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { workspaceErrorMessage } from '../../../../shared/services/workspace-api.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    I18nModule,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule
  ],
  templateUrl: './register.html',
  styleUrls: ['../login/login.css', './register.css']
})
export class RegisterComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly intent = inject(SignupIntentService);
  readonly purpose = this.intent.spaceType();
  registerForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  hidePassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private registrationFlow: RegistrationFlowService,
    private authState: AuthStateService,
    private router: Router,
    private feedback: NotificationService
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/)
      ]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator });

    this.authState.getState().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state: AuthState) => {
      if (!this.isLoading) this.errorMessage = state.error || '';
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.invalid || this.isLoading || this.successMessage || !this.intent.spaceType()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.authState.clearError();
    this.successMessage = '';

    const { full_name, email, password } = this.registerForm.value;

    this.registrationFlow.complete({ full_name, email, password }).pipe(
      finalize(() => { this.isLoading = false; this.authState.setLoading(false); this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => {
        this.successMessage = 'Your space is ready. Opening inventory…';
        void this.router.navigate(['/inventory'], { queryParams: { spaceId: created.space.id.value, wineCellarId: created.cellar.id.value } });
      },
      error: (error: HttpErrorResponse) => {
        const fallback = this.intent.needsSetup(email)
          ? 'Your account was created. Retry to finish preparing your space, or sign in. Your account will not be registered again.'
          : 'Registration failed';
        this.errorMessage = workspaceErrorMessage(error, fallback);
        this.authState.setError(this.errorMessage);
      }
    });
  }

  onGoogleSignIn(): void {
    this.feedback.show('Google sign-up is not available yet.', 'warning', 3000);
  }
}
