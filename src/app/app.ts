import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AssistantWidgetComponent } from './assistant/assistant-widget';
import { SubscriptionApiService } from './shared/services/subscription-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    AssistantWidgetComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {
  constructor() { inject(SubscriptionApiService).connectWorkspace(); }
  private readonly router = inject(Router);
  readonly assistantVisible = toSignal(this.router.events.pipe(
    filter(event => event instanceof NavigationEnd), startWith(null),
    map(() => /^\/(overview|devices|alerts|cavas|inventory|spaces|subscription|profile)(?:\/|\?|$)/.test(this.router.url)),
  ), { initialValue: false });
  title = 'multi-bc-app';
}
