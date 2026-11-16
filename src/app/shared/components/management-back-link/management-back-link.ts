import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Explicit return destination also works for direct links and new tabs. */
@Component({
  selector: 'app-management-back-link', standalone: true, imports: [RouterLink],
  template: `<a [routerLink]="destination" [attr.aria-label]="label" class="flex items-center gap-2 rounded-lg border border-[#30363D] bg-[#21262D] px-3 py-2 text-xs font-medium text-[#C9D1D9] hover:bg-[#30363D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"><span aria-hidden="true">←</span> Volver</a>`,
  styles: [':host { display: inline-block; flex-shrink: 0; } a { text-decoration: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagementBackLinkComponent {
  @Input() destination = '/spaces';
  @Input() label = 'Volver a espacios';
}
