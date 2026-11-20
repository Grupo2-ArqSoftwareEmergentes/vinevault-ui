import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Notification, NotificationService } from '../../services/notification/notification';

interface Toast extends Notification { id: number; leaving: boolean; }
interface Lifetime { remaining: number; started: number; timer?: ReturnType<typeof setTimeout>; hovered: boolean; focused: boolean; }

@Component({
  selector: 'app-notification-host', standalone: true,
  templateUrl: './notification-host.html', styleUrl: './notification-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationHostComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly lifetimes = new Map<number, Lifetime>();
  private sequence = 0;
  readonly notices = signal<readonly Toast[]>([]);
  readonly labels = { success: 'Listo', error: 'No se pudo completar', warning: 'Aviso', info: 'Información' };

  constructor() {
    inject(NotificationService).getNotifications().pipe(takeUntilDestroyed()).subscribe(notice => this.add(notice));
    this.destroyRef.onDestroy(() => {
      for (const lifetime of this.lifetimes.values()) clearTimeout(lifetime.timer);
      this.lifetimes.clear();
    });
  }

  private add(notice: Notification): void {
    if (!notice.message.trim()) return;
    // Refresh duplicate feedback, and retain at most three compact notices.
    for (const previous of this.notices()) {
      if (previous.message === notice.message && previous.type === notice.type) this.remove(previous.id);
    }
    if (this.notices().length >= 3) this.remove(this.notices()[0].id);
    const id = ++this.sequence;
    const duration = typeof notice.duration === 'number' && Number.isFinite(notice.duration) && notice.duration > 0 ? notice.duration : 4000;
    this.lifetimes.set(id, { remaining: duration, started: Date.now(), hovered: false, focused: false });
    this.notices.update(notices => [...notices, { ...notice, id, leaving: false }]);
    this.schedule(id);
  }

  hold(id: number, reason: 'hovered' | 'focused', held: boolean): void {
    const lifetime = this.lifetimes.get(id);
    if (!lifetime || this.notices().find(notice => notice.id === id)?.leaving) return;
    const paused = lifetime.hovered || lifetime.focused;
    lifetime[reason] = held;
    if (!paused && (lifetime.hovered || lifetime.focused)) {
      clearTimeout(lifetime.timer);
      lifetime.remaining = Math.max(0, lifetime.remaining - (Date.now() - lifetime.started));
    } else if (paused && !lifetime.hovered && !lifetime.focused) this.schedule(id);
  }

  dismiss(id: number): void {
    const lifetime = this.lifetimes.get(id);
    if (!lifetime || this.notices().find(notice => notice.id === id)?.leaving) return;
    clearTimeout(lifetime.timer);
    this.notices.update(notices => notices.map(notice => notice.id === id ? { ...notice, leaving: true } : notice));
    lifetime.timer = setTimeout(() => this.remove(id), 180);
  }

  private schedule(id: number): void {
    const lifetime = this.lifetimes.get(id);
    if (!lifetime) return;
    lifetime.started = Date.now();
    lifetime.timer = setTimeout(() => this.dismiss(id), lifetime.remaining);
  }

  private remove(id: number): void {
    clearTimeout(this.lifetimes.get(id)?.timer);
    this.lifetimes.delete(id);
    this.notices.update(notices => notices.filter(notice => notice.id !== id));
  }
}
