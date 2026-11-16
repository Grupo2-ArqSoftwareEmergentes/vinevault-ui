import { ChangeDetectorRef, Component, DestroyRef, Injector, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginUseCase } from '../../../domain/use-cases/login/login';
import { AuthState, AuthStateService } from '../../state/auth-state/auth-state';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SignupIntentService } from '../../state/signup-intent/signup-intent';
import { RegistrationFlowService } from '../../state/signup-intent/registration-flow.service';
import { workspaceErrorMessage } from '../../../../shared/services/workspace-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnInit {
  private readonly intent = inject(SignupIntentService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private submitting = false;
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  hidePassword = true;

  constructor(
    private fb: FormBuilder,
    private loginUseCase: LoginUseCase,
    private authState: AuthStateService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.authState.getState().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state: AuthState) => {
      this.isLoading = this.submitting || state.isLoading;
      this.errorMessage = state.error || '';
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading) {
      return;
    }

    this.submitting = true;
    this.authState.setLoading(true);
    this.authState.clearError();

    const { username, password } = this.loginForm.value;

    this.loginUseCase.execute({ username, password }).pipe(
      switchMap((response) => {
        const email = response.user?.email ?? username;
        return this.intent.needsSetup(email) ? this.injector.get(RegistrationFlowService).finishPending(email) : of(null);
      }),
      finalize(() => { this.submitting = false; this.authState.setLoading(false); this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => {
        if (created) void this.router.navigate(['/inventory'], { queryParams: { spaceId: created.space.id.value, wineCellarId: created.cellar.id.value } });
        else void this.router.navigate(['/overview']);
      },
      error: (error: HttpErrorResponse) => {
        this.authState.setError(workspaceErrorMessage(error, 'Unable to sign in or finish preparing your space. Please retry.'));
      }
    });
  }

  onGoogleSignIn(): void {
    this.snackBar.open('Google sign-in is not available yet.', 'Close', {
      duration: 3000
    });
  }
}
