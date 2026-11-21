import { Injectable, signal } from '@angular/core';
import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';

/** Only intent and a recovery marker are stored for this tab. Never credentials. */
@Injectable({ providedIn: 'root' })
export class SignupIntentService {
  private readonly key = 'vinevault_signup_intent';
  private readonly state = signal<{ space_type: SpaceType | null; pending_email: string | null }>(this.restore());
  readonly spaceType = () => this.state().space_type;

  select(spaceType: SpaceType): void {
    this.save({ ...this.state(), space_type: spaceType });
  }

  accountCreated(email: string): void {
    this.save({ ...this.state(), pending_email: email.trim().toLowerCase() });
  }

  needsSetup(email: string): boolean {
    return !!this.spaceType() && this.state().pending_email === email.trim().toLowerCase();
  }

  clear(): void {
    this.state.set({ space_type: null, pending_email: null });
    try { sessionStorage.removeItem(this.key); } catch { /* In-memory state still works. */ }
  }

  private save(state: { space_type: SpaceType | null; pending_email: string | null }): void {
    this.state.set(state);
    try { sessionStorage.setItem(this.key, JSON.stringify(state)); } catch { /* Storage may be unavailable. */ }
  }

  private restore(): { space_type: SpaceType | null; pending_email: string | null } {
    try {
      const value = JSON.parse(sessionStorage.getItem(this.key) ?? 'null');
      if (value?.space_type === 'COLLECTOR' || value?.space_type === 'BUSINESS') {
        return { space_type: value.space_type, pending_email: typeof value.pending_email === 'string' ? value.pending_email : null };
      }
    } catch { /* Invalid or unavailable session storage is not an authorization source. */ }
    return { space_type: null, pending_email: null };
  }
}
