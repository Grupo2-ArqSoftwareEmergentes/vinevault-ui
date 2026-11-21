import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AssistantWidgetComponent } from './assistant-widget';
import { AssistantChatResponse, AssistantService } from './assistant.service';
import { WorkspaceContextService, WorkspaceSelection } from '../shared/services/workspace-context.service';
import { ownerAccess, enabledPlanFeatures } from '../shared/testing/workspace.fixtures';
import { WorkspaceAccessService } from '../shared/services/workspace-access.service';
import { provideRouter } from '@angular/router';
import { AssistantLauncherService } from './assistant-launcher.service';
import { I18nService } from '../core/i18n/i18n.service';
import { PREFERRED_LANGUAGE_STORAGE_KEY } from '../core/i18n/language';

const space = { ...ownerAccess, id: { value: 'space-1' }, name: 'Colección' };
const cellar = { id: { value: 'cellar-1' }, spaceId: space.id, name: 'Principal' };
const response: AssistantChatResponse = { reply: 'Hay vino disponible.\n• Sugerencia: servir fresco.', mode: 'CHAT', context_summary: { space: { id: 'space-1', name: 'Colección', purpose: 'COLLECTOR' }, cellar: { id: 'cellar-1', name: 'Principal' } } };

describe('Floating assistant conversation', () => {
  let fixture: ComponentFixture<AssistantWidgetComponent>;
  let component: AssistantWidgetComponent;
  let selection: ReturnType<typeof signal<WorkspaceSelection>>;
  let changes: BehaviorSubject<WorkspaceSelection>;
  const chat = vi.fn();
  const select = (value: WorkspaceSelection) => { selection.set(value); changes.next(value); };

  beforeEach(async () => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    selection = signal<WorkspaceSelection>({ space, cellar });
    changes = new BehaviorSubject(selection());
    chat.mockReset().mockImplementation(() => of(response));
    TestBed.configureTestingModule({ imports: [AssistantWidgetComponent], providers: [
      provideRouter([]),
      { provide: AssistantService, useValue: { chat } },
      { provide: WorkspaceContextService, useValue: { selection, selectionChanges: changes.asObservable() } },
    ] });
    fixture = TestBed.createComponent(AssistantWidgetComponent);
    vi.spyOn(TestBed.inject(WorkspaceAccessService), 'capabilities').mockReturnValue(enabledPlanFeatures);
    vi.spyOn(TestBed.inject(WorkspaceAccessService), 'space').mockImplementation(() => selection().space);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('opens with visible context, focuses the composer and closes on Escape without clearing the thread', async () => {
    fixture.nativeElement.querySelector('.assistant-trigger').click();
    await fixture.whenStable();
    const panel = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel.textContent).toContain('Colección');
    expect(panel.textContent).toContain('Principal');
    expect(document.activeElement?.id).toBe('assistant-message');
    component.draft.setValue('¿Hay vino?');
    component.send();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(component.open()).toBe(false);
    expect(component.messages()).toHaveLength(2);
    expect(document.activeElement?.classList.contains('assistant-trigger')).toBe(true);
    component.toggle();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.message')).toHaveLength(2);
  });

  it('opens the same widget from an external quick action without submitting an AI prompt', async () => {
    TestBed.inject(AssistantLauncherService).show();
    await fixture.whenStable();
    expect(component.open()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(component.messages()).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
  });

  it('sends chat only on demand and preserves new typing while waiting, blocking duplicate sends', async () => {
    const pending = new Subject<AssistantChatResponse>();
    chat.mockReturnValue(pending);
    component.draft.setValue('¿Hay vino?');
    expect(chat).not.toHaveBeenCalled();
    component.send();
    component.send();
    expect(chat).toHaveBeenCalledExactlyOnceWith({ spaceId: 'space-1', cellarId: 'cellar-1' }, 'CHAT', '¿Hay vino?', []);
    expect(component.pending()).toBe(true);
    component.draft.setValue('Mi siguiente pregunta');
    pending.next(response);
    expect(component.draft.value).toBe('Mi siguiente pregunta');
    expect(component.pending()).toBe(false);
    expect(component.messages().map(message => message.role)).toEqual(['user', 'assistant']);
  });

  it('sends Sommelier diagnostics for a cellar or the whole space without a typed message', () => {
    component.selectMode('SOMMELIER_ANALYSIS');
    component.send();
    expect(chat.mock.calls[0][1]).toBe('SOMMELIER_ANALYSIS');
    expect(chat.mock.calls[0][2]).toContain('cava seleccionada');
    select({ space, cellar: null });
    component.send();
    expect(chat.mock.calls[1][0]).toEqual({ spaceId: 'space-1', cellarId: undefined });
    expect(chat.mock.calls[1][2]).toContain('espacio activo');
    expect(chat.mock.calls[1][3]).toEqual([]);
  });

  it('bounds history to ten completed, alternating messages and excludes the current prompt', () => {
    for (let i = 0; i < 8; i++) { component.draft.setValue(`Consulta ${i}`); component.send(); }
    const history = chat.mock.calls[7][3];
    expect(history).toHaveLength(10);
    expect(history[0].content).toBe('Consulta 2');
    expect(history.at(-1).role).toBe('assistant');
    expect(history.map((message: { role: string }) => message.role)).toEqual(Array.from({ length: 10 }, (_, i) => i % 2 ? 'assistant' : 'user'));
  });

  for (const change of ['space', 'cellar', 'role', 'logout'] as const) {
    it(`clears conversation and cancels stale replies on ${change} changes`, () => {
      component.toggleExpanded();
      component.draft.setValue('Primera consulta');
      component.send();
      const pending = new Subject<AssistantChatResponse>();
      chat.mockReturnValue(pending);
      component.draft.setValue('Consulta pendiente');
      component.send();
      select(change === 'logout' ? { space: null, cellar: null }
        : change === 'space' ? { space: { ...space, id: { value: 'space-2' } }, cellar: null }
          : change === 'cellar' ? { space, cellar: { ...cellar, id: { value: 'cellar-2' } } }
            : { space: { ...space, role: 'WAITER' }, cellar });
      pending.next(response);
      expect(component.messages()).toEqual([]);
      expect(component.pending()).toBe(false);
      expect(component.draft.value).toBe('');
      expect(component.notice()).toContain('El contexto cambió');
      expect(component.expanded()).toBe(true);
    });
  }

  it('does not clear a thread for same-context metadata refreshes', () => {
    component.draft.setValue('Consulta');
    component.send();
    select({ space: { ...space, name: 'Renombrado' }, cellar: { ...cellar } });
    expect(component.messages()).toHaveLength(2);
  });

  it('does not send without context, on whitespace-only prompts or above the confirmed limit', async () => {
    component.draft.setValue('   ');
    component.send();
    component.draft.setValue('a'.repeat(2001));
    component.send();
    expect(component.error()).toContain('2000');
    select({ space: null, cellar: null });
    component.send();
    component.toggle();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Selecciona primero un espacio');
    expect(chat).not.toHaveBeenCalled();
  });

  for (const status of [0, 403, 422, 500]) {
    it(`retains previous history and draft on HTTP ${status}, without automatic retry`, () => {
      component.draft.setValue('Primera consulta');
      component.send();
      chat.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status })));
      component.draft.setValue('Consulta fallida');
      component.send();
      expect(component.messages()).toHaveLength(3);
      expect(component.messages().at(-1)?.failed).toBe(true);
      expect(component.draft.value).toBe('Consulta fallida');
      expect(component.pending()).toBe(false);
      expect(component.error()).toContain(status === 403 ? 'permiso de análisis' : status === 422 ? '2000' : 'conectar');
      expect(chat).toHaveBeenCalledTimes(2);
      component.draft.setValue('Nueva pregunta');
      component.send();
      expect(chat.mock.calls[2][3]).toEqual([{ role: 'user', content: 'Primera consulta' }, { role: 'assistant', content: response.reply }]);
    });
  }

  afterEach(() => { localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY); document.documentElement.lang = 'es'; });

  for (const mode of ['CHAT', 'SOMMELIER_ANALYSIS'] as const) it(`renders safe Markdown in ${mode} while keeping user text and request history raw`, async () => {
    const reply = '### Diagnóstico\n\n**Conservar** y *disfrutar*.\n\n- Primero\n- Segundo\n\n1. Abrir\n2. Servir\n\n`stock`\n\n```js\nconst stock = 2;\n```\n\nOtro párrafo.';
    chat.mockReturnValue(of({ ...response, reply, mode }));
    component.toggle(); component.selectMode(mode);
    component.draft.setValue('**Consulta** <img src=x onerror=alert(1)>'); component.send();
    await fixture.whenStable();
    const markdown = fixture.nativeElement.querySelector('.assistant-markdown') as HTMLElement;
    expect(markdown.querySelector('h3')?.textContent).toBe('Diagnóstico');
    expect(markdown.querySelector('strong')?.textContent).toBe('Conservar');
    expect(markdown.querySelector('em')?.textContent).toBe('disfrutar');
    expect(markdown.querySelectorAll('ul li')).toHaveLength(2);
    expect(markdown.querySelectorAll('ol li')).toHaveLength(2);
    expect(markdown.querySelector('pre code')?.textContent).toContain('const stock = 2;');
    expect(markdown.querySelectorAll('p').length).toBeGreaterThan(1);
    expect(fixture.nativeElement.querySelector('.from-user strong, .from-user img')).toBeNull();
    if (mode === 'CHAT') expect(fixture.nativeElement.querySelector('.from-user').textContent).toContain('**Consulta** <img');
    component.draft.setValue('Siguiente consulta'); component.send();
    expect(chat.mock.calls[1][3][1].content).toBe(reply);
  });

  it('sanitizes executable HTML, event handlers and unsafe links in AI Markdown', async () => {
    chat.mockReturnValue(of({ ...response, reply: '<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[Unsafe](javascript:alert%281%29)\n\n**Texto seguro**' }));
    component.toggle();
    component.draft.setValue('Consulta');
    component.send();
    await fixture.whenStable();
    const markdown = fixture.nativeElement.querySelector('.assistant-markdown') as HTMLElement;
    expect(markdown.querySelector('script, [onerror]')).toBeNull();
    expect(markdown.querySelector('a')?.getAttribute('href')).not.toMatch(/^javascript:/i);
    expect(markdown.querySelector('strong')?.textContent).toBe('Texto seguro');
  });

  it('resizes in place and localizes its toggle without losing focus, drafts, requests or context', async () => {
    const pending = new Subject<AssistantChatResponse>(); chat.mockReturnValue(pending);
    component.toggle(); component.draft.setValue('Consulta'); component.send();
    component.draft.setValue('Borrador siguiente'); await fixture.whenStable();
    const panel = fixture.nativeElement.querySelector('.assistant-panel');
    const composer = fixture.nativeElement.querySelector('textarea');
    const button = fixture.nativeElement.querySelector('.expand-button') as HTMLButtonElement;
    button.focus(); button.click(); await fixture.whenStable();
    expect(panel.classList.contains('is-expanded')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Contraer asistente');
    expect(document.activeElement).toBe(button);
    expect(fixture.nativeElement.querySelector('textarea')).toBe(composer);
    expect(component.draft.value).toBe('Borrador siguiente'); expect(component.pending()).toBe(true);
    TestBed.inject(I18nService).setLanguage('en'); await fixture.whenStable();
    expect(button.getAttribute('aria-label')).toBe('Collapse assistant');
    expect(panel.textContent).toContain('Colección'); expect(panel.textContent).toContain('Principal');
    pending.next(response); await fixture.whenStable();
    expect(component.messages()).toHaveLength(2); expect(chat).toHaveBeenCalledTimes(1);
    button.click(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.assistant-panel')).toBe(panel);
    expect(button.getAttribute('aria-label')).toBe('Expand assistant');
    expect(component.messages()).toHaveLength(2);
  });

  it('closes an expanded Sommelier panel with Escape and reopens the same conversation and size', async () => {
    component.toggle(); component.toggleExpanded(); component.selectMode('SOMMELIER_ANALYSIS'); component.send();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.assistant-panel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(component.open()).toBe(false);
    expect(document.activeElement?.classList.contains('assistant-trigger')).toBe(true);
    component.toggle(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.assistant-panel.is-expanded')).toBeTruthy();
    expect(component.mode()).toBe('SOMMELIER_ANALYSIS');
    expect(fixture.nativeElement.querySelector('.assistant-markdown')).toBeTruthy();
    expect(component.messages()).toHaveLength(2); expect(chat).toHaveBeenCalledTimes(1);
  });

  it('cancels pending work when destroyed', () => {
    const pending = new Subject<AssistantChatResponse>();
    chat.mockReturnValue(pending);
    component.draft.setValue('Consulta');
    component.send();
    fixture.destroy();
    pending.next(response);
    expect(component.pending()).toBe(false);
    expect(component.messages()).toHaveLength(1);
  });

  it('surfaces PLAN_FEATURE_UNAVAILABLE clearly when 403 comes from plan restrictions', () => {
    chat.mockReturnValueOnce(throwError(() => new HttpErrorResponse({
      status: 403,
      error: { detail: { code: 'PLAN_FEATURE_UNAVAILABLE', message: 'La función de IA no está incluida en el plan actual.' } },
    })));
    component.draft.setValue('Analiza mi cava');
    component.send();
    expect(component.error()).toBe('La función de IA no está incluida en el plan actual.');
  });

  it('guards programmatic chat and Sommelier submissions when server capabilities deny them', async () => {
    vi.spyOn(TestBed.inject(WorkspaceAccessService), 'capabilities').mockReturnValue({ assistant_chat: false, sommelier_analysis: false });
    component.draft.setValue('Analiza mi cava');
    component.send(); component.selectMode('SOMMELIER_ANALYSIS'); component.send();
    expect(chat).not.toHaveBeenCalled();
    expect(component.messages()).toHaveLength(0);
  });
});
