import { Injectable, signal } from '@angular/core';

/** Shared UI state lets quick actions open the existing widget without sending a prompt. */
@Injectable({ providedIn: 'root' })
export class AssistantLauncherService {
  readonly isOpen = signal(false);
  show(): void { this.isOpen.set(true); }
  toggle(): void { this.isOpen.update(value => !value); }
  close(): void { this.isOpen.set(false); }
}
