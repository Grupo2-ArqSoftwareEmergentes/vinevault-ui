import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { AddWineInventoryItemDialogComponent, AddWineInventoryItemDialogData } from './add-wine-inventory-item-dialog.component';

describe('Purpose-specific inventory form', () => {
  const close = vi.fn();
  function setup(data: Partial<AddWineInventoryItemDialogData> = {}) {
    close.mockReset();
    TestBed.configureTestingModule({ imports: [AddWineInventoryItemDialogComponent], providers: [
      { provide: MAT_DIALOG_DATA, useValue: { title: 'Inventory', submitLabel: 'Save', ...data } },
      { provide: MatDialogRef, useValue: { close } },
    ] });
    return TestBed.createComponent(AddWineInventoryItemDialogComponent);
  }

  it('permits a name-only create with explicit zero quantity, no wine type or age', () => {
    const component = setup().componentInstance;
    component.form.patchValue({ name: ' Reserva ', quantity: 0 });
    expect(component.form.valid).toBe(true);
    component.submit();
    expect(close).toHaveBeenCalledExactlyOnceWith({ name: 'Reserva', quantity: 0 });
  });

  for (const purpose of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`patches only changed visible fields in ${purpose}, without clearing hidden values`, async () => {
      const fixture = setup({ purpose, initialValue: {
        name: 'Reserva', quantity: 0, vintage: '2020', salePrice: '25.00', supplierName: 'Supplier',
        rating: '88.00', aromaTags: ['oak'], wouldBuyAgain: false, purchasePrice: '19.99',
      } });
      await fixture.whenStable();
      const component = fixture.componentInstance;
      component.form.controls['purchasePrice'].setValue('15.50');
      if (purpose === 'COLLECTOR') {
        expect(fixture.nativeElement.querySelector('[data-field="salePrice"]')).toBeNull();
        component.form.controls['aromaTags'].setValue([]);
      } else {
        expect(fixture.nativeElement.querySelector('[data-field="rating"]')).toBeNull();
        component.form.controls['supplierName'].setValue(null);
      }
      component.submit();
      expect(close).toHaveBeenCalledExactlyOnceWith(purpose === 'COLLECTOR'
        ? { purchasePrice: '15.50', aromaTags: [] }
        : { purchasePrice: '15.50', supplierName: null });
    });
  }

  it('does not emit an update for an unchanged form and preserves false/zero/null distinctions', () => {
    const component = setup({ initialValue: { name: 'Reserva', quantity: 0, bodySlider: '0.00', wouldBuyAgain: false, aromaTags: [] } }).componentInstance;
    component.submit();
    expect(close).toHaveBeenCalledWith();
  });

  it('validates scales, decimal precision, vintage, integer stock and nullable optional fields', () => {
    const component = setup().componentInstance;
    component.form.patchValue({ name: 'Reserva', quantity: 1 });
    for (const [key, value] of [['rating', '0'], ['rating', '101'], ['bodySlider', '5.01'], ['alcoholPercentage', '101'], ['purchasePrice', '2.123'], ['vintage', '20'], ['quantity', 1.5]] as const) {
      const control = component.form.controls[key];
      control.setValue(value);
      expect(control.invalid).toBe(true);
      control.setValue(key === 'quantity' ? 0 : null);
    }
    component.form.patchValue({ vintage: 'NV', rating: '100.00', bodySlider: '0.00', aciditySlider: '4.50', purchaseDate: '2026-11-16', wouldBuyAgain: false });
    expect(component.form.valid).toBe(true);
    component.submit();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0, vintage: 'NV', rating: '100.00', bodySlider: '0.00', wouldBuyAgain: false, purchaseDate: '2026-11-16' }));
  });

  it('stores individual aroma strings, including commas, as an array instead of splitting text', () => {
    const component = setup().componentInstance;
    component.form.patchValue({ name: 'Reserva' });
    component.tagDraft = ' red fruit, fresh ';
    component.addTag();
    expect(component.tags).toEqual(['red fruit, fresh']);
    component.submit();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ aromaTags: ['red fruit, fresh'] }));
  });
});
