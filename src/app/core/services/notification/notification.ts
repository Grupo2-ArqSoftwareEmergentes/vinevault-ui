import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { TranslationParams } from '../../i18n/i18n.service';

export interface Notification {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  params?: TranslationParams;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new Subject<Notification>();

  getNotifications(): Observable<Notification> {
    return this.notificationSubject.asObservable();
  }

  show(message: string, type: Notification['type'] = 'info', duration: number = 4000, params?: TranslationParams): void {
    this.notificationSubject.next({ message, type, duration, ...(params ? { params } : {}) });
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  warning(message: string): void {
    this.show(message, 'warning');
  }

  info(message: string): void {
    this.show(message, 'info');
  }
}
