import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, defer, distinctUntilChanged, finalize, map, take } from 'rxjs';
import { WorkspaceContextService } from '../shared/services/workspace-context.service';
import { AssistantMessage, AssistantMode, AssistantService, ASSISTANT_MESSAGE_LIMIT } from './assistant.service';

interface DisplayMessage extends AssistantMessage { mode: AssistantMode; failed?: boolean; }

@Component({
  selector: 'app-assistant-widget', standalone: true, imports: [ReactiveFormsModule],
  templateUrl: './assistant-widget.html', styleUrl: './assistant-widget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantWidgetComponent {
  readonly workspace = inject(WorkspaceContextService);
  private readonly assistant = inject(AssistantService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private request?: Subscription;
  private history: AssistantMessage[] = [];
  private version = 0;
  @ViewChild('composer') set composer(element: ElementRef<HTMLTextAreaElement> | undefined) { element?.nativeElement.focus(); }
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('transcript') private transcript?: ElementRef<HTMLElement>;
  readonly open = signal(false);
  readonly pending = signal(false);
  readonly mode = signal<AssistantMode>('CHAT');
  readonly messages = signal<readonly DisplayMessage[]>([]);
  readonly notice = signal('');
  readonly error = signal('');
  readonly limit = ASSISTANT_MESSAGE_LIMIT;
  readonly draft = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(ASSISTANT_MESSAGE_LIMIT)] });
  readonly hasSpace = computed(() => !!this.workspace.selection().space);

  constructor() {
    let previousSpace: string | undefined;
    this.workspace.selectionChanges.pipe(
      map(({ space, cellar }) => ({ spaceId: space?.id.value, key: [space?.id.value, cellar?.id.value, space?.role, space?.subscriptionPlan, space?.subscriptionStatus].join(':') })),
      distinctUntilChanged((a, b) => a.key === b.key), takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ spaceId }) => {
      const changed = !!previousSpace;
      previousSpace = spaceId;
      this.version++;
      this.request?.unsubscribe();
      this.pending.set(false);
      this.messages.set([]);
      this.history = [];
      this.draft.reset();
      this.error.set('');
      this.notice.set(changed ? 'El contexto cambió. Hemos iniciado una conversación nueva.' : '');
    });
  }

  toggle(): void { this.open.update(value => !value); }
  close(): void { this.open.set(false); this.trigger?.nativeElement.focus(); }
  selectMode(mode: AssistantMode): void { this.mode.set(mode); }

  send(): void {
    if (this.pending()) return;
    const { space, cellar } = this.workspace.selection();
    if (!space) { this.error.set('Selecciona primero un espacio en la barra superior para conversar con el asistente.'); return; }
    const mode = this.mode();
    if (mode === 'CHAT' && this.draft.invalid) {
      this.draft.markAsTouched();
      this.error.set('Escribe un mensaje de 1 a 2000 caracteres, no solo espacios.');
      return;
    }
    const content = mode === 'CHAT' ? this.draft.value.trim()
      : `Realiza un diagnóstico del inventario ${cellar ? 'de la cava seleccionada' : 'del espacio activo'} y sugiere acciones priorizadas de conservación, consumo y gestión de stock.`;
    const version = this.version;
    const user: DisplayMessage = { role: 'user', content, mode };
    this.messages.update(messages => [...messages, user]);
    this.pending.set(true);
    this.error.set('');
    this.notice.set('');
    this.scrollToLatest();
    this.request = defer(() => this.assistant.chat({ spaceId: space.id.value, cellarId: cellar?.id.value }, mode, content, this.history)).pipe(
      take(1), takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.pending.set(false); }),
    ).subscribe({
      next: response => {
        if (version !== this.version) return;
        if (typeof response?.reply !== 'string' || !response.reply.trim()) {
          this.fail(user, 'El asistente no devolvió una respuesta. Puedes intentarlo de nuevo cuando quieras.');
          return;
        }
        const reply = response.reply.trim();
        this.messages.update(messages => [...messages, { role: 'assistant', content: reply, mode }]);
        const completed: AssistantMessage[] = [...this.history, { role: 'user', content }, { role: 'assistant', content: reply }];
        this.history = completed.slice(-10);
        if (mode === 'CHAT' && this.draft.value.trim() === content) this.draft.reset();
        this.scrollToLatest();
      },
      error: error => {
        if (version !== this.version || (error instanceof HttpErrorResponse && error.status === 401)) return;
        this.fail(user, error instanceof HttpErrorResponse && error.status === 403
          ? 'Este espacio o membresía requiere permiso de análisis para usar el asistente.'
          : error instanceof HttpErrorResponse && error.status === 422
            ? 'Revisa el mensaje: no debe estar vacío ni superar los 2000 caracteres.'
            : 'No pudimos conectar con el asistente. Tu conversación se conserva; puedes intentarlo más tarde.');
      },
    });
  }

  private fail(user: DisplayMessage, message: string): void {
    this.messages.update(messages => messages.map(item => item === user ? { ...item, failed: true } : item));
    this.error.set(message);
    this.scrollToLatest();
  }
  private scrollToLatest(): void {
    // Run after Angular paints the new messages; no HTML/Markdown injection from AI output.
    afterNextRender(() => {
      const element = this.transcript?.nativeElement;
      if (!this.destroyRef.destroyed && element) element.scrollTop = element.scrollHeight;
    }, { injector: this.injector });
  }
}
