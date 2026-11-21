export type PreferredLanguage = 'es' | 'en';
export const PREFERRED_LANGUAGE_STORAGE_KEY = 'vinevault.preferred-language';

export function normalizePreferredLanguage(value: unknown): PreferredLanguage {
  return typeof value === 'string' && value.trim().toLowerCase() === 'en' ? 'en' : 'es';
}
