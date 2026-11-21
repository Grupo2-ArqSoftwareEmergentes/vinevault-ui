import { I18nModule } from '../core/i18n/i18n.module';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, defer, distinctUntilChanged, finalize, map, take } from 'rxjs';
import { WorkspaceContextService } from '../shared/services/workspace-context.service';
import { planFeatureUnavailableDetail } from '../shared/services/workspace-quota';
import { AssistantMessage, AssistantMode, AssistantService, ASSISTANT_MESSAGE_LIMIT } from './assistant.service';
import { AssistantLauncherService } from './assistant-launcher.service';
import { WorkspaceAccessService } from '../shared/services/workspace-access.service';
import { PlanFeatureNoticeComponent } from '../shared/components/plan-feature-notice/plan-feature-notice';
import { I18nService } from '../core/i18n/i18n.service';
import { MarkdownPipe } from '../invetory_intelligence/interfaces/pipes/markdown.pipe';

interface DisplayMessage extends AssistantMessage { mode: AssistantMode; failed?: boolean; }

@Component({
  selector: 'app-assistant-widget', standalone: true, imports: [I18nModule, ReactiveFormsModule, PlanFeatureNoticeComponent, MarkdownPipe],
  templateUrl: './assistant-widget.html', styleUrl: './assistant-widget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantWidgetComponent {
  readonly workspace = inject(WorkspaceContextService);
  readonly access = inject(WorkspaceAccessService);
  private readonly i18n = inject(I18nService);
  readonly feature = computed(() => this.mode() === 'CHAT' ? 'assistant_chat' : 'sommelier_analysis');
  readonly canSend = computed(() => this.access.hasFeature(this.feature()));
  private readonly assistant = inject(AssistantService);
  private readonly launcher = inject(AssistantLauncherService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private request?: Subscription;
  private history: AssistantMessage[] = [];
  private version = 0;
  @ViewChild('composer') set composer(element: ElementRef<HTMLTextAreaElement> | undefined) { element?.nativeElement.focus(); }
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('transcript') private transcript?: ElementRef<HTMLElement>;
  readonly open = this.launcher.isOpen.asReadonly();
  readonly pending = signal(false);
  readonly expanded = signal(false);
  readonly mode = signal<AssistantMode>('CHAT');
  readonly messages = signal<readonly DisplayMessage[]>([]);
  readonly notice = signal('');
  readonly error = signal('');
  readonly featureUnavailable = signal(false);
  readonly limit = ASSISTANT_MESSAGE_LIMIT;
  readonly draft = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(ASSISTANT_MESSAGE_LIMIT)] });
  readonly hasSpace = computed(() => !!this.workspace.selection().space);

  constructor() {
    this.destroyRef.onDestroy(() => this.launcher.close());
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
      this.featureUnavailable.set(false);
      this.notice.set(changed ? 'El contexto cambió. Hemos iniciado una conversación nueva.' : '');
    });
  }

  toggle(): void { this.launcher.toggle(); }
  toggleExpanded(): void { this.expanded.update(value => !value); }
  close(): void { this.launcher.close(); this.trigger?.nativeElement.focus(); }
  selectMode(mode: AssistantMode): void { this.mode.set(mode); this.featureUnavailable.set(false); }

  send(): void {
    if (this.pending()) return;
    const { space, cellar } = this.workspace.selection();
    if (!space) { this.error.set('Selecciona primero un espacio en la barra superior para conversar con el asistente.'); return; }
    if (!this.canSend()) return;
    const mode = this.mode();
    if (mode === 'CHAT' && this.draft.invalid) {
      this.draft.markAsTouched();
      this.error.set('Escribe un mensaje de 1 a 2000 caracteres, no solo espacios.');
      return;
    }
    const content = mode === 'CHAT' ? this.draft.value.trim()
      : this.i18n.t('Realiza un diagnóstico del inventario {scope} y sugiere acciones priorizadas de conservación, consumo y gestión de stock.', { scope: this.i18n.t(cellar ? 'de la cava seleccionada' : 'del espacio activo') });
    const version = this.version;
    const user: DisplayMessage = { role: 'user', content, mode };
    this.messages.update(messages => [...messages, user]);
    this.pending.set(true);
    this.error.set('');
    this.featureUnavailable.set(false);
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
        const planUnavailable = planFeatureUnavailableDetail(error);
        this.featureUnavailable.set(!!planUnavailable);
        this.fail(user, planUnavailable
          ? planUnavailable.message
          : error instanceof HttpErrorResponse && error.status === 403
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
    // Wait for the sanitized Markdown and message layout before scrolling.
    afterNextRender(() => {
      const element = this.transcript?.nativeElement;
      if (!this.destroyRef.destroyed && element) element.scrollTop = element.scrollHeight;
    }, { injector: this.injector });
  }
}
