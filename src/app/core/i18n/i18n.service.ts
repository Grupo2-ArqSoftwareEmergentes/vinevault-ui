import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from '../services/storage/storage';
import {
  PREFERRED_LANGUAGE_STORAGE_KEY,
  PreferredLanguage,
  normalizePreferredLanguage,
} from './language';
import { EN } from './locales/en';
import { ES } from './locales/es';

export type TranslationParams = Readonly<Record<string, string | number | null | undefined>>;

/** Source-message keys (gettext style). Never translate account data or AI responses. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly state = signal<PreferredLanguage>(this.readStored());
  readonly language = this.state.asReadonly();
  readonly locale = computed(() => (this.language() === 'en' ? 'en-PE' : 'es-PE'));
  private version = 0;
  private readonly dateFormatters = new Map<string, Intl.DateTimeFormat>();
  get revision(): number {
    return this.version;
  }

  constructor() {
    this.document.documentElement.lang = this.language();
  }

  setLanguage(value: unknown): void {
    const language = normalizePreferredLanguage(value);
    this.version++;
    this.state.set(language);
    this.document.documentElement.lang = language;
    try {
      this.storage.set(PREFERRED_LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* In-memory language still works. */
    }
  }

  t(source: string | null | undefined, params: TranslationParams = {}): string {
    if (!source) return '';
    const key = source.trim();
    const dictionary = this.language() === 'en' ? EN : ES;
    const translated = Object.prototype.hasOwnProperty.call(dictionary, key)
      ? dictionary[key]
      : key;
    return (
      source.slice(0, source.indexOf(key)) +
      translated.replace(/\{(\w+)\}/g, (match, name: string) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name] ?? '') : match,
      ) +
      source.slice(source.indexOf(key) + key.length)
    );
  }

  date(value: string | number | Date | null | undefined, format = 'mediumDate'): string {
    if (value === null || value === undefined || value === '') return '—';
    let date: Date;
    const calendar = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
    if (calendar) {
      const [year, month, day] = calendar.slice(1).map(Number);
      date = new Date(0);
      date.setFullYear(year, month - 1, day);
      date.setHours(0, 0, 0, 0);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return '—';
      }
    } else date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const locale = this.locale();
    const dateStyle = format.startsWith('short') ? 'short' : 'medium';
    const withTime = !format.endsWith('Date');
    const key = `${locale}:${dateStyle}:${withTime}`;
    let formatter = this.dateFormatters.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, {
        dateStyle,
        ...(withTime ? { timeStyle: 'short' as const } : {}),
      });
      this.dateFormatters.set(key, formatter);
    }
    return formatter.format(date);
  }

  private readStored(): PreferredLanguage {
    try {
      return normalizePreferredLanguage(this.storage.get(PREFERRED_LANGUAGE_STORAGE_KEY));
    } catch {
      return 'es';
    }
  }
}
