import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { StockMovementDialogComponent } from './stock-movement-dialog';
import { StockMovementService } from '../../../application/internal/commandservices/stock-movement.service';
import { StockMovement } from '../../../domain/model/stock-movement';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';
import { SpaceRole } from '../../../../device/domain/model/valueobjects/space-access';

describe('Stock movement dialog', () => {
  const create = vi.fn();
  const list = vi.fn(() => of([]));
  const dialogRef = { close: vi.fn(), disableClose: false };
  let pending: Subject<StockMovement>;
  beforeEach(() => {
    pending = new Subject<StockMovement>();
    create.mockReset().mockReturnValue(pending);
    list.mockClear();
    dialogRef.close.mockReset();
    dialogRef.disableClose = false;
    TestBed.configureTestingModule({ imports: [StockMovementDialogComponent], providers: [
      { provide: StockMovementService, useValue: { create, list } },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { mode: 'exit', spaceId: 'space-1', item: { id: { value: 'item-1' }, wineCellarId: { value: 'cellar-1' }, name: 'Reserva', quantity: 1 } } },
    ] });
    activate('OWNER');
  });

  function activate(role: SpaceRole) {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, role, id: { value: 'space-1' }, name: 'Space' });
  }

  it('locks the form and dismissal during the single atomic POST and returns stock_after', async () => {
    const fixture = TestBed.createComponent(StockMovementDialogComponent);
    await fixture.whenStable();
    expect(list).toHaveBeenCalledWith('cellar-1', 'item-1');
    fixture.componentInstance.form.patchValue({ reason: 'uncorking', notes: ' Dinner ' });
    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledExactlyOnceWith('cellar-1', 'item-1', { quantity: 1, reason: 'uncorking', notes: 'Dinner' });
    expect(dialogRef.disableClose).toBe(true);
    expect(fixture.nativeElement.querySelector('.submit-movement').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[mat-dialog-close]').disabled).toBe(true);
    const movement = { id: 'move-1', stockAfter: 0 } as StockMovement;
    pending.next(movement);
    pending.complete();
    expect(dialogRef.close).toHaveBeenCalledWith(movement);
    expect(dialogRef.disableClose).toBe(false);
  });

  for (const role of ['OWNER', 'SOMMELIER', 'INVENTORY_CLERK', 'WAITER'] as const) {
    it(`enforces ${role} movement permissions while retaining history access`, async () => {
      activate(role);
      const fixture = TestBed.createComponent(StockMovementDialogComponent);
      await fixture.whenStable();
      fixture.componentInstance.submit();
      expect(list).toHaveBeenCalledOnce();
      if (role === 'WAITER') {
        expect(create).not.toHaveBeenCalled();
        expect(fixture.nativeElement.querySelector('.movement-form')).toBeNull();
      } else expect(create).toHaveBeenCalledOnce();
    });
  }

  for (const [status, message] of [[409, 'Stock insuficiente'], [403, 'permisos'], [404, 'no existe'], [422, 'Datos inválidos'], [0, 'evitar una salida duplicada']] as const) {
    it(`handles ${status} without retries or a partial local stock discount`, async () => {
      const fixture = TestBed.createComponent(StockMovementDialogComponent);
      await fixture.whenStable();
      fixture.componentInstance.submit();
      pending.error(new HttpErrorResponse({ status }));
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.error').textContent).toContain(message);
      expect(fixture.componentInstance.data.item.quantity).toBe(1);
      fixture.componentInstance.submit();
      expect(create).toHaveBeenCalledOnce();
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(dialogRef.disableClose).toBe(false);
    });
  }

  it('rejects fractional/zero exits and prevents submission after a context change', async () => {
    const fixture = TestBed.createComponent(StockMovementDialogComponent);
    await fixture.whenStable();
    for (const quantity of [0, -1, 1.5]) {
      fixture.componentInstance.form.controls.quantity.setValue(quantity);
      fixture.componentInstance.submit();
    }
    fixture.componentInstance.form.controls.quantity.setValue(1);
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-2' }, name: 'Other' });
    fixture.componentInstance.submit();
    expect(create).not.toHaveBeenCalled();
  });
});
