import { Injectable, signal, computed, inject } from '@angular/core';
import { SubscriptionState, PaymentDetails } from '../models/payment.model';
import { Observable, timer, map } from 'rxjs';
import { AuthStateService } from '../../../../iam/presentation/state/auth-state/auth-state';
import { User } from '../../../../iam/domain/models/user';

@Injectable({
  providedIn: 'root'
})
export class MockPaymentService {
  private readonly STORAGE_KEY = 'vinevault_subscription';
  private readonly authStateService = inject(AuthStateService);
  
  // Create reactive state via Angular Signal
  private readonly subscriptionState = signal<SubscriptionState>(this.loadInitialState());

  // Expose read-only subscription signal
  readonly subscription = this.subscriptionState.asReadonly();

  // Track the logged-in user reactively
  private readonly currentUser = signal<User | null>(null);

  // Compute the effective plan for the logged-in user
  readonly effectivePlan = computed<'FREE' | 'PREMIUM'>(() => {
    const state = this.subscription();
    if (state.plan === 'FREE') return 'FREE';

    const user = this.currentUser();
    if (!user) return 'FREE';

    // Subscriber owner gets Premium
    if (state.ownerUsername && state.ownerUsername === user.username) {
      return 'PREMIUM';
    }

    // Guest delegated users get Premium
    const emailMatch = user.email && state.invitedUsers?.includes(user.email);
    const usernameMatch = state.invitedUsers?.includes(user.username);
    if (emailMatch || usernameMatch) {
      return 'PREMIUM';
    }

    return 'FREE';
  });

  constructor() {
    // Keep the current user signal in sync with IAM Auth State
    this.authStateService.getState().subscribe(state => {
      if (state.user) {
        this.currentUser.set(state.user);
      } else {
        // Fallback simulated user for frontend-only demo to bypass 401 errors
        this.currentUser.set({
          username: 'usuario_demo',
          email: 'usuario@demo.com'
        });
      }
    });
  }

  private loadInitialState(): SubscriptionState {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // Fallback to default
      }
    }
    return {
      plan: 'FREE',
      status: 'INACTIVE',
      usersLimit: 1,
      invitedUsers: []
    };
  }

  processPayment(details: PaymentDetails): Observable<SubscriptionState> {
    const cleanNumber = details.cardNumber.replace(/\s+/g, '');
    const user = this.currentUser();
    
    return timer(2000).pipe(
      map(() => {
        if (cleanNumber === '4242424242424242') {
          const transactionId = `VV-${Math.floor(100000 + Math.random() * 900000)}`;
          const successState: SubscriptionState = {
            plan: 'PREMIUM',
            status: 'ACTIVE',
            usersLimit: 10,
            transactionId,
            ownerUsername: user?.username || 'admin',
            invitedUsers: this.subscription().invitedUsers || []
          };
          this.updateSubscription(successState);
          return successState;
        } else if (cleanNumber === '4000000000000002') {
          throw new Error('El pago no pudo procesarse. La tarjeta fue rechazada.');
        } else {
          throw new Error('Número de tarjeta no admitido para la simulación. Use 4242-4242-4242-4242 para aprobación o 4000-0000-0000-0002 para rechazo.');
        }
      })
    );
  }

  inviteUser(identifier: string): void {
    const state = this.subscription();
    if (state.plan !== 'PREMIUM') {
      throw new Error('Debes estar en el Plan Premium para delegar accesos.');
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    if (!cleanIdentifier) return;

    const invited = state.invitedUsers ? [...state.invitedUsers] : [];
    if (invited.includes(cleanIdentifier)) {
      throw new Error('El usuario ya ha sido invitado.');
    }
    if (invited.length >= 10) {
      throw new Error('Has alcanzado el límite de 10 usuarios invitados.');
    }

    invited.push(cleanIdentifier);
    this.updateSubscription({
      ...state,
      invitedUsers: invited
    });
  }

  removeInvitedUser(identifier: string): void {
    const state = this.subscription();
    if (state.plan !== 'PREMIUM') return;

    const cleanIdentifier = identifier.trim().toLowerCase();
    const invited = state.invitedUsers ? state.invitedUsers.filter(u => u !== cleanIdentifier) : [];
    this.updateSubscription({
      ...state,
      invitedUsers: invited
    });
  }

  resetToFree(): void {
    const freeState: SubscriptionState = {
      plan: 'FREE',
      status: 'INACTIVE',
      usersLimit: 1,
      invitedUsers: []
    };
    this.updateSubscription(freeState);
  }

  private updateSubscription(state: SubscriptionState): void {
    this.subscriptionState.set(state);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }
}
