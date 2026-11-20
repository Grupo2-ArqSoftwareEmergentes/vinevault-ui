export type PreferredLanguage = 'es' | 'en';

export const PREFERRED_LANGUAGE_STORAGE_KEY = 'vinevault.preferred-language';

export const SUPPORTED_LANGUAGES: readonly { code: PreferredLanguage; label: string }[] = [
  { code: 'es', label: 'Español (es)' },
  { code: 'en', label: 'Inglés (en)' },
];

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  preferred_language: PreferredLanguage;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  last_login: string | null;
}

export interface UpdateProfilePayload {
  username?: string;
  email?: string;
  full_name?: string;
  preferred_language?: PreferredLanguage;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  message?: string;
  sessions_revoked?: boolean;
  security_notice?: string;
}

export function normalizePreferredLanguage(value: unknown): PreferredLanguage {
  if (typeof value === 'string' && value.trim().toLowerCase() === 'en') return 'en';
  return 'es';
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function userInitialsFrom(fullName?: string | null, username?: string | null, email?: string | null): string {
  const name = (fullName ?? '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  const fallback = (username ?? '').trim() || (email ?? '').trim().split('@')[0] || '';
  return fallback.slice(0, 2).toUpperCase();
}
