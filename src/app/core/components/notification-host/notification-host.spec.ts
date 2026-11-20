import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotificationHostComponent } from './notification-host';
import { NotificationService } from '../../services/notification/notification';

describe('Floating notification host', () => {
  let fixture: ComponentFixture<NotificationHostComponent>;
  let service: NotificationService;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [NotificationHostComponent] });
    fixture = TestBed.createComponent(NotificationHostComponent);
    service = TestBed.inject(NotificationService);
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); vi.useRealTimers(); });

  it('announces feedback without moving focus and fades it away after four seconds', () => {
    const focused = document.activeElement;
    service.success('Idioma actualizado.'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Idioma actualizado.');
    expect(document.activeElement).toBe(focused);
    vi.advanceTimersByTime(3999); expect(fixture.componentInstance.notices()[0].leaving).toBe(false);
    vi.advanceTimersByTime(1); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast.leaving')).toBeTruthy();
    vi.advanceTimersByTime(180); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });
  it('provides an accessible manual close and error announcements', () => {
    service.error('No se pudo guardar.'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    fixture.nativeElement.querySelector('[aria-label="Cerrar notificación"]').click();
    vi.advanceTimersByTime(180); fixture.detectChanges();
    expect(fixture.componentInstance.notices()).toHaveLength(0);
  });
  it('bounds bursts to three cards and refreshes duplicates instead of stacking them', () => {
    for (const message of ['Uno', 'Dos', 'Tres', 'Cuatro']) service.info(message);
    expect(fixture.componentInstance.notices().map(notice => notice.message)).toEqual(['Dos', 'Tres', 'Cuatro']);
    vi.advanceTimersByTime(1000); service.info('Cuatro');
    expect(fixture.componentInstance.notices()).toHaveLength(3);
    vi.advanceTimersByTime(3180);
    expect(fixture.componentInstance.notices().map(notice => notice.message)).toEqual(['Cuatro']);
    vi.advanceTimersByTime(1000);
    expect(fixture.componentInstance.notices()).toHaveLength(0);
  });
  it('pauses the remaining duration while hovered or keyboard-focused, resuming only after both end', () => {
    service.warning('Revisa los cambios.');
    const id = fixture.componentInstance.notices()[0].id;
    vi.advanceTimersByTime(2000);
    fixture.componentInstance.hold(id, 'hovered', true);
    fixture.componentInstance.hold(id, 'focused', true);
    vi.advanceTimersByTime(10000);
    fixture.componentInstance.hold(id, 'hovered', false);
    vi.advanceTimersByTime(10000);
    expect(fixture.componentInstance.notices()[0].leaving).toBe(false);
    fixture.componentInstance.hold(id, 'focused', false);
    vi.advanceTimersByTime(1999); expect(fixture.componentInstance.notices()[0].leaving).toBe(false);
    vi.advanceTimersByTime(181); expect(fixture.componentInstance.notices()).toHaveLength(0);
  });
  it('supports longer security notices and falls back safely for invalid durations', () => {
    service.show('Aviso de seguridad.', 'success', 6000);
    service.show('Duración inválida.', 'info', -1);
    service.show('   ');
    expect(fixture.componentInstance.notices()).toHaveLength(2);
    vi.advanceTimersByTime(4180);
    expect(fixture.componentInstance.notices().map(notice => notice.message)).toEqual(['Aviso de seguridad.']);
    vi.advanceTimersByTime(2000); expect(fixture.componentInstance.notices()).toHaveLength(0);
  });
  it('renders untrusted backend messages as plain text', () => {
    service.error('<img src=x onerror=alert(1)>'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<img src=x onerror=alert(1)>');
  });
  it('cancels timers and unsubscribes on destruction', () => {
    service.success('Antes'); fixture.detectChanges();
    fixture.destroy(); service.success('Después'); vi.advanceTimersByTime(10000);
    expect(fixture.componentInstance.notices().map(notice => notice.message)).toEqual(['Antes']);
  });
});
