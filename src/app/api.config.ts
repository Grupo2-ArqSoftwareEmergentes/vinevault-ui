import { environment } from '../environments/environment';

export const API_CONFIG = {
  baseUrl: environment.apiBaseUrl,
  endpoints: {
    organizations: '/api/v1/organizations',
    spaces: '/api/v1/spaces',
    devices: '/api/v1/devices',
    wineCellars: '/api/v1/wine-cellars',
    userContext: '/api/v1/user/context',
    analyzeStock: '/api/v1/ai/analyze-stock',
    autocompleteWine: '/api/v1/inventory/ai-autocomplete',
    assistantChat: '/api/v1/assistant/chat',
    exportInventory: '/api/v1/inventory/export',
    onboarding: '/api/v1/user/onboarding',
  },
} as const;

/** Accept either a Core host or a base URL already ending in /api/v1. */
export function apiUrl(path: string, baseUrl: string = API_CONFIG.baseUrl): string {
  const base = baseUrl.replace(/\/+$/, '');
  return base.endsWith('/api/v1') && path.startsWith('/api/v1/') ? base + path.slice('/api/v1'.length) : base + path;
}
