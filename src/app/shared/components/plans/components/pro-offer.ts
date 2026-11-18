import { InjectionToken } from '@angular/core';

/** Display-only commercial configuration; never grants server entitlements. */
export const PRO_MONTHLY_PRICES = new InjectionToken<Readonly<{ COLLECTOR: string; BUSINESS: string }>>('PRO_MONTHLY_PRICES', {
  providedIn: 'root', factory: () => ({ COLLECTOR: 'S/ 29.99', BUSINESS: 'S/ 79.99' }),
});
/** Set to a real support/activation URL when that channel is available. */
export const PRO_ACTIVATION_CONTACT = new InjectionToken<string | null>('PRO_ACTIVATION_CONTACT', {
  providedIn: 'root', factory: () => null,
});
