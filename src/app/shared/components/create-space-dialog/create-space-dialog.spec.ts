import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { CreateSpaceDialogComponent, EXTRA_SPACE_MONTHLY_PRICE } from './create-space-dialog';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { AccountQuota, CreatedWorkspace } from '../../models/workspace-context';

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
    expect(fixture.nativeElement.querySelector('[mat-dialog-close]').disabled).toBe(true);
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
    fixture.nativeElement.querySelector('[mat-dialog-close]').click();
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

  it('unlocks the form after a synchronous creation error', () => {
    createSpace.mockImplementation(() => { throw new Error('Invalid context'); });
    const component = TestBed.createComponent(CreateSpaceDialogComponent).componentInstance;
    component.name = 'Collection';
    component.spaceType = 'COLLECTOR';
    component.submit();
    expect(component.saving).toBe(false);
    expect(component.error).toBeTruthy();
    expect(dialogRef.disableClose).toBe(false);
  });

  const exhausted: AccountQuota = { extra_spaces_allowance: 0, current_spaces: 2, max_spaces: 2, remaining_spaces: 0, can_create_collector: false, can_create_business: false };

  for (const quota of [exhausted, { ...exhausted, remaining_spaces: 1 }, { ...exhausted, can_create_business: true }]) {
    it(`replaces blocked controls with an add-on offer when remaining=${quota.remaining_spaces}, capabilities=${quota.can_create_collector}/${quota.can_create_business}`, async () => {
      accountQuota.set(quota);
      const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.eyebrow')?.textContent).toBe('VINEVAULT · ADD-ON');
      expect(element.querySelector('#create-space-title')?.textContent).toContain('Has alcanzado el límite');
      expect(element.querySelector('[name="workspaceName"]')).toBeNull();
      expect(element.querySelector('fieldset, .purpose-card')).toBeNull();
      expect(element.querySelector('button[type="submit"]')).toBeNull();
      expect(element.querySelector('.extra-space-offer')?.textContent).toContain('Cupo de Espacio Adicional');
      expect(element.textContent).toContain('2 / 2');
      expect(element.querySelectorAll('.offer-benefits li')).toHaveLength(3);
      expect(element.querySelector('.offer-benefits')?.textContent).toContain('Plan Free con su Cava Principal');
      fixture.componentInstance.name = 'Bypass attempt';
      fixture.componentInstance.spaceType = 'BUSINESS';
      fixture.componentInstance.submit();
      expect(createSpace).not.toHaveBeenCalled();
    });
  }

  it('uses a configurable placeholder monthly price, not an invented confirmed tariff', async () => {
    TestBed.overrideProvider(EXTRA_SPACE_MONTHLY_PRICE, { useValue: 'S/ XX' });
    accountQuota.set(exhausted);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.offer-price').textContent).toContain('S/ XX / mes');
    expect(fixture.nativeElement.querySelector('.offer-price-note').textContent).toContain('Precio por confirmar');
  });

  it('shows a clean coming-soon notice without HTTP requests, creation or local allowance mutations', async () => {
    accountQuota.set(exhausted);
    const original = accountQuota();
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.acquire-extra-space').click();
    fixture.nativeElement.querySelector('.acquire-extra-space').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('#extra-space-payment-notice')).toHaveLength(1);
    const notice = fixture.nativeElement.querySelector('[role="status"]');
    expect(notice.textContent).toContain('Pagos disponibles próximamente');
    expect(notice.textContent).toContain('No se ha realizado ningún cobro ni se ha añadido un cupo');
    expect(accountQuota()).toBe(original);
    expect(accountQuota()?.extra_spaces_allowance).toBe(0);
    expect(createSpace).not.toHaveBeenCalled();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    fixture.nativeElement.querySelector('[mat-dialog-close]').click();
    expect(dialogRef.close).toHaveBeenCalledOnce();
  });

  it('reacts to quota exhaustion and renewal without erasing a draft or leaving a stale payment notice', async () => {
    accountQuota.set({ ...exhausted, current_spaces: 1, remaining_spaces: 1, can_create_business: true });
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    await fixture.whenStable();
    fixture.componentInstance.name = 'My draft';
    fixture.componentInstance.spaceType = 'BUSINESS';
    accountQuota.set(exhausted);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    fixture.nativeElement.querySelector('.acquire-extra-space').click();
    await fixture.whenStable();
    accountQuota.set({ ...exhausted, extra_spaces_allowance: 1, max_spaces: 3, remaining_spaces: 1, can_create_business: true });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.extra-space-offer')).toBeNull();
    expect(fixture.nativeElement.querySelector('[name="workspaceName"]').value).toBe('My draft');
    expect(fixture.nativeElement.querySelector('[data-purpose="BUSINESS"]').getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.paymentNotice()).toBe(false);
    expect(fixture.nativeElement.querySelector('#extra-space-payment-notice')).toBeNull();
    expect(createSpace).not.toHaveBeenCalled();
  });

  it('does not activate the add-on action during an existing creation request', async () => {
    const pending = new Subject<CreatedWorkspace>();
    createSpace.mockReturnValue(pending);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    fixture.componentInstance.name = 'Space';
    fixture.componentInstance.spaceType = 'COLLECTOR';
    fixture.componentInstance.submit();
    accountQuota.set(exhausted);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.acquire-extra-space').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[mat-dialog-close]').disabled).toBe(true);
    fixture.componentInstance.acquireExtraSpace();
    expect(fixture.componentInstance.paymentNotice()).toBe(false);
    expect(createSpace).toHaveBeenCalledOnce();
    pending.error(new HttpErrorResponse({ status: 403, error: { detail: { code: 'SPACE_LIMIT_REACHED', message: 'Cuenta sin cupos' } } }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.error').textContent).toBe('Cuenta sin cupos');
    expect(fixture.nativeElement.querySelector('.acquire-extra-space').disabled).toBe(false);
  });
});
