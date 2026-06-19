import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginUseCase } from '../../../domain/use-cases/login/login';
import { AuthState, AuthStateService } from '../../state/auth-state/auth-state';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSnackBarModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnInit {
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

    this.authState.getState().subscribe((state: AuthState) => {
      this.isLoading = state.isLoading;
      this.errorMessage = state.error || '';
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.authState.setLoading(true);
    this.authState.clearError();

    const { username, password } = this.loginForm.value;

    this.loginUseCase.execute({ username, password }).subscribe({
      next: () => {
        this.router.navigate(['/overview']);
      },
      error: (error: HttpErrorResponse) => {
        this.authState.setError(error.error?.detail || 'Login failed');
      }
    });
  }

  onGoogleSignIn(): void {
    this.snackBar.open('Google sign-in is not available yet.', 'Close', {
      duration: 3000
    });
  }
}
