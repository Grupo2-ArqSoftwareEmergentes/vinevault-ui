import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { I18nService } from './i18n.service';
import { I18nModule } from './i18n.module';
import { StorageService } from '../services/storage/storage';
import { PREFERRED_LANGUAGE_STORAGE_KEY } from '../../iam/domain/models/profile';
import { formatSolesMoney } from '../../shared/models/subscription-summary';
import { wineFormFields } from '../../inventory/interfaces/components/wine-inventory-form/wine-form-fields';
import { EN } from './locales/en';
import { ES } from './locales/es';

@Component({
  imports: [I18nModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>{{ 'Cuenta y Perfil' | t }}</h1>
    <p>{{ 'Alerta · {name}' | t: { name: name } }}</p>
    <button [attr.aria-label]="'Cerrar' | t">{{ 'Guardar' | t }}</button>`,
})
class Host {
  name = '<b>Inventario</b>';
}

describe('Reactive application language', () => {
  beforeEach(() => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    TestBed.configureTestingModule({ imports: [Host] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    document.documentElement.lang = 'es';
  });

  it('initializes from persisted language, updates html.lang, and persists explicit selection', () => {
    TestBed.inject(StorageService).set(PREFERRED_LANGUAGE_STORAGE_KEY, 'en');
    const i18n = TestBed.inject(I18nService);
    expect(i18n.language()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.t('Cuenta y Perfil')).toBe('Account & Profile');
    i18n.setLanguage('es');
    expect(i18n.t('Overview')).toBe('Resumen');
    expect(TestBed.inject(StorageService).get(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });
  it('updates an already rendered OnPush template and accessible labels without replacing account data', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button');
    button.focus();
    TestBed.inject(I18nService).setLanguage('en');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Account & Profile');
    expect(button.getAttribute('aria-label')).toBe('Close');
    expect(fixture.nativeElement.querySelector('p').textContent).toBe('Alert · <b>Inventario</b>');
    expect(fixture.nativeElement.querySelector('b')).toBeNull();
    expect(document.activeElement).toBe(button);
    TestBed.inject(I18nService).setLanguage('es');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Cuenta y Perfil');
  });
  it('handles unavailable storage and unknown message keys safely', () => {
    vi.spyOn(TestBed.inject(StorageService), 'get').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(TestBed.inject(StorageService), 'set').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    const i18n = TestBed.inject(I18nService);
    expect(i18n.language()).toBe('es');
    expect(() => i18n.setLanguage('en')).not.toThrow();
    for (const value of ['constructor', '__proto__', 'Unknown server response'])
      expect(i18n.t(value)).toBe(value);
  });
  it('localizes dates and parameterized quantities while keeping soles and decimal amounts unchanged', () => {
    const i18n = TestBed.inject(I18nService);
    const date = new Date(2026, 0, 20, 12);
    expect(i18n.date(date)).toContain('ene');
    i18n.setLanguage('en');
    expect(i18n.date(date)).toContain('Jan');
    expect(i18n.t('Hasta {count} cavas base incluidas (+ add-ons).', { count: 3 })).toContain(
      '3 base cellars',
    );
    expect(formatSolesMoney('29.99', 'PEN')).toBe('S/ 29.99');
    expect(i18n.date('invalid')).toBe('—');
    expect(i18n.date('2026-01-20')).toBe(i18n.date(new Date(2026, 0, 20)));
    expect(i18n.date('2026-02-30')).toBe('—');
  });
  it('has English labels for every visible wine form field', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    for (const field of wineFormFields.filter((field) => !field.hidden)) {
      expect(Object.hasOwn(EN, field.label) || Object.hasOwn(ES, field.label)).toBe(true);
      expect(i18n.t(field.label).length).toBeGreaterThan(0);
    }
  });
  it('localizes legacy action feedback and preserves opaque values in message parameters', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.t('Wine deleted')).toBe('Vino eliminado');
    expect(i18n.t('Sensor paired. Claim token: {token}', { token: 'Inventory' })).toBe(
      'Sensor vinculado. Token de vinculación: Inventory',
    );
    i18n.setLanguage('en');
    expect(i18n.t('Cava creada')).toBe('Cellar created');
    expect(i18n.t('Wine deleted')).toBe('Wine deleted');
  });
});
