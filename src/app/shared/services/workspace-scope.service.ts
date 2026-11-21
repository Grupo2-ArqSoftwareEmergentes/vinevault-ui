import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { WorkspaceSpace } from '../models/workspace-context';

/** Request lifetime follows the space and its authorization, never a JWT claim. */
@Injectable({ providedIn: 'root' })
export class WorkspaceScopeService {
  private readonly spaceState = signal<WorkspaceSpace | null>(null);
  readonly space = this.spaceState.asReadonly();
  private controller = new AbortController();
  private readonly changes = new Subject<void>();
  readonly changed = this.changes.asObservable();
  private readonly sessionChanges = new Subject<void>();
  readonly sessionChanged = this.sessionChanges.asObservable();
  get signal(): AbortSignal { return this.controller.signal; }
  invalidateSession(): void {
    this.activate(null, true);
    this.sessionChanges.next();
  }
  activate(space: WorkspaceSpace | null, force = false): void {
    const previous = this.space();
    this.spaceState.set(space);
    if (!force && previous?.id.value === space?.id.value && previous?.role === space?.role && previous?.subscriptionPlan === space?.subscriptionPlan && previous?.subscriptionStatus === space?.subscriptionStatus) return;
    this.controller.abort();
    this.controller = new AbortController();
    this.changes.next();
  }
}
