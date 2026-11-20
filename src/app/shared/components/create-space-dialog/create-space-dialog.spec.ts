import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { CreateSpaceDialogComponent } from './create-space-dialog';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { AccountQuota, CreatedWorkspace } from '../../models/workspace-context';
import { API_CONFIG } from '../../../api.config';
import { sampleCatalogResource } from '../../testing/workspace.fixtures';

const base = API_CONFIG.baseUrl;

describe('Create Space dialog', () => {
  const createSpace = vi.fn();
  const dialogRef = { close: vi.fn(), disableClose: false };
  const accountQuota = signal<AccountQuota | undefined>(undefined);

  beforeEach(() => {
    createSpace.mockReset().mockReturnValue(of({}));
    accountQuota.set(undefined);
    dialogRef.close.mockReset();
    dialogRef.disableClose = false;
    TestBed.configureTestingModule({ imports: [CreateSpaceDialogComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: WorkspaceContextService, useValue: { createSpace, accountQuota } },
      { provide: MatDialogRef, useValue: dialogRef },
    ] });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  for (const purpose of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`requires an explicit purpose and sends a trimmed ${purpose} name`, async () => {
      const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      component.name = '  My space  ';
      component.submit();
      expect(createSpace).not.toHaveBeenCalled();
      const card = fixture.nativeElement.querySelector(`[data-purpose="${purpose}"]`) as HTMLButtonElement;
      card.click();
      await fixture.whenStable();
      expect(card.getAttribute('aria-pressed')).toBe('true');
      expect(card.classList.contains('selected')).toBe(true);
      expect(fixture.nativeElement.textContent.match(/Plan Free incluido/g)).toHaveLength(2);
      component.submit();
      expect(createSpace).toHaveBeenCalledExactlyOnceWith('My space', purpose);
      expect(dialogRef.close).toHaveBeenCalledOnce();
    });
  }

  it('rejects whitespace names and prevents duplicate submissions or dismissal while pending', async () => {
    const pending = new Subject<CreatedWorkspace>();
    createSpace.mockReturnValue(pending);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    const component = fixture.componentInstance;
    component.spaceType = 'BUSINESS';
    component.name = '   ';
    component.submit();
    expect(createSpace).not.toHaveBeenCalled();
    component.name = 'Business';
    component.submit();
    component.submit();
    await fixture.whenStable();
    expect(createSpace).toHaveBeenCalledOnce();
    expect(dialogRef.disableClose).toBe(true);
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.cancel-action').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.primary-action').disabled).toBe(true);
    pending.error(new Error('Offline'));
    await fixture.whenStable();
    expect(component.saving).toBe(false);
    expect(dialogRef.disableClose).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.name).toBe('Business');
    expect(component.spaceType).toBe('BUSINESS');
  });

  it('allows cancellation without submitting', async () => {
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.cancel-action').click();
    expect(dialogRef.close).toHaveBeenCalledOnce();
    expect(createSpace).not.toHaveBeenCalled();
  });

  it('disables only the exhausted purpose, then rechecks changed account capacities at submission', async () => {
    accountQuota.set({ extra_spaces_allowance: 0, current_spaces: 1, max_spaces: 2, remaining_spaces: 1, can_create_collector: false, can_create_business: true });
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-purpose="COLLECTOR"]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-purpose="BUSINESS"]').disabled).toBe(false);
    fixture.componentInstance.name = 'Business';
    fixture.componentInstance.spaceType = 'COLLECTOR';
    fixture.componentInstance.submit();
    expect(createSpace).not.toHaveBeenCalled();
    fixture.componentInstance.spaceType = 'BUSINESS';
    accountQuota.update(quota => ({ ...quota!, can_create_business: false }));
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(`${base}/api/v1/subscriptions/catalog`).flush(sampleCatalogResource);
    fixture.componentInstance.submit();
    expect(createSpace).not.toHaveBeenCalled();
  });

  it('shows a quota rejection message without losing the entered name or selected purpose', async () => {
    const pending = new Subject<CreatedWorkspace>();
    createSpace.mockReturnValue(pending);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    fixture.componentInstance.name = 'My space';
    fixture.componentInstance.spaceType = 'COLLECTOR';
    fixture.componentInstance.submit();
    pending.error(new HttpErrorResponse({ status: 403, error: { detail: { code: 'SPACE_LIMIT_REACHED', message: 'No hay cupo Collector' } } }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toBe('No hay cupo Collector');
    expect(fixture.componentInstance.name).toBe('My space');
    expect(fixture.componentInstance.spaceType).toBe('COLLECTOR');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  const exhausted: AccountQuota = { extra_spaces_allowance: 0, current_spaces: 2, max_spaces: 2, remaining_spaces: 0, can_create_collector: false, can_create_business: false };

  it('loads EXTRA_SPACE catalog tariffs, sends integer quantity with idempotency reuse/regeneration and never mutates local allowance', async () => {
    accountQuota.set(exhausted);
    const original = accountQuota();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush(sampleCatalogResource);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.eyebrow, .offer-eyebrow, .courtesy-note, .offer-scope')).toBeNull();
    expect(element.querySelector('header')?.textContent?.trim()).toBe('Solicitar Espacio Adicional');
    expect(element.textContent).not.toMatch(/USD|\$|\bPEN\b/);
    expect(element.textContent).toContain('S/ 20.00');
    expect(element.querySelector('.currency-options')).toBeNull();
    expect(element.textContent).not.toMatch(/EXTRA_SPACE|cortesía|Espacios de la cuenta/);
    expect(element.querySelector('.extra-space-total')).toBeNull();
    expect(element.textContent).toContain('Pago simulado / entorno de pruebas');

    const component = fixture.componentInstance;
    const key1 = component.idempotencyKey();

    // Only soles are selectable; unsupported currency cannot change the request.
    component.selectCurrency('USD');
    const key2 = component.idempotencyKey();
    expect(key2).toBe(key1);
    expect(component.selectedPrice()?.currency).toBe('PEN');

    component.onQuantityChange(3);
    const key3 = component.idempotencyKey();
    expect(key3).not.toBe(key2);

    // Invalid quantity blocks submission.
    component.onQuantityChange(0);
    fixture.detectChanges();
    expect(element.querySelector<HTMLButtonElement>('.acquire-extra-space')!.disabled).toBe(true);
    component.onQuantityChange(2);
    const key4 = component.idempotencyKey();
    fixture.detectChanges();

    // First attempt fails with 503 -> key4 is reused on retry.
    element.querySelector<HTMLButtonElement>('.acquire-extra-space')!.click();
    const firstPost = http.expectOne(`${base}/api/v1/subscriptions/extra-space-requests`);
    expect(firstPost.request.body).toEqual({ currency: 'PEN', quantity: 2, idempotency_key: key4, confirm_simulated_payment: true });
    expect(dialogRef.disableClose).toBe(true);
    component.acquireExtraSpace();
    component.onQuantityChange(3);
    expect(component.quantityInput()).toBe(2);
    expect(typeof firstPost.request.body.quantity).toBe('number');
    firstPost.flush({}, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    expect(component.idempotencyKey()).toBe(key4);

    // Retry succeeds with 202 Accepted.
    element.querySelector<HTMLButtonElement>('.acquire-extra-space')!.click();
    const retryPost = http.expectOne(`${base}/api/v1/subscriptions/extra-space-requests`);
    expect(retryPost.request.body.idempotency_key).toBe(key4);
    retryPost.flush({
      id: 'extra-1',
      kind: 'EXTRA_SPACE',
      status: 'PENDING_PAYMENT',
      entitlement_scope: 'ACCOUNT',
      entitlements_applied: false,
      space_id: null,
      currency: 'PEN',
      quantity: 2,
      unit_amount: '20.00',
      total_amount: '40.00',
      created_at: '2026-11-19T20:20:00Z',
    }, { status: 202, statusText: 'Accepted' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith({ extraSpaceRequested: true, activated: false, intent: expect.objectContaining({ id: 'extra-1', total_amount: '40.00' }) });
    expect(dialogRef.disableClose).toBe(false);
    component.acquireExtraSpace();
    http.expectNone(req => req.method === 'POST');
    expect(accountQuota()).toBe(original);
    expect(accountQuota()?.extra_spaces_allowance).toBe(0);
    expect(createSpace).not.toHaveBeenCalled();
  });

  it('opens directly in extra-space CTA mode with server current/limit from SPACE_LIMIT_REACHED', async () => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {
      useValue: { mode: 'extra-space', current: 2, limit: 2, message: 'Límite de espacios alcanzado.' },
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush(sampleCatalogResource);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Límite de espacios alcanzado.');
    expect(fixture.nativeElement.textContent).not.toContain('(2 / 2)');
    expect(fixture.nativeElement.querySelector('.acquire-extra-space')).toBeTruthy();
  });

  it('never falls back to USD or submits when the official soles tariff is unavailable', async () => {
    accountQuota.set(exhausted);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush({ ...sampleCatalogResource, addons: [{ code: 'EXTRA_SPACE', scope: 'ACCOUNT', prices: [{ currency: 'USD', amount: '5.00' }] }] });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Tarifa en soles no disponible');
    expect(fixture.nativeElement.textContent).not.toMatch(/USD|\$|\bPEN\b/);
    expect(fixture.componentInstance.selectedPrice()).toBeNull();
    expect(fixture.nativeElement.querySelector('.acquire-extra-space').disabled).toBe(true);
    fixture.componentInstance.acquireExtraSpace();
    http.expectNone(req => req.method === 'POST');
  });

  it('validates quantity without calculating a local price or subtotal', async () => {
    accountQuota.set(exhausted);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush(sampleCatalogResource);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('#extra-space-quantity') as HTMLInputElement;
    expect(input.value).toBe('1');
    expect(input.min).toBe('1'); expect(input.max).toBe('100');
    for (const [value, total] of [['2', 'S/ 40.00 / mes'], ['100', 'S/ 2000.00 / mes'], ['0', '—'], ['101', '—'], ['1.5', '—'], ['', '—']]) {
      input.value = value; input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.extra-space-total')).toBeNull();
      expect(fixture.nativeElement.querySelector('.acquire-extra-space').disabled).toBe(total === '—');
    }
    http.expectNone(req => req.method === 'POST');
  });
});
