import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../../../domain/models/user';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null
};

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private state = new BehaviorSubject<AuthState>(initialState);

  getState(): Observable<AuthState> {
    return this.state.asObservable();
  }

  getCurrentState(): AuthState {
    return this.state.getValue();
  }

  setLoading(isLoading: boolean): void {
    this.state.next({
      ...this.state.getValue(),
      isLoading
    });
  }

  setAuthenticated(user: User): void {
    this.state.next({
      ...this.state.getValue(),
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
  }

  setError(error: string): void {
    this.state.next({
      ...this.state.getValue(),
      error,
      isLoading: false
    });
  }

  logout(): void {
    this.state.next(initialState);
  }

  clearError(): void {
    this.state.next({
      ...this.state.getValue(),
      error: null
    });
  }
}
