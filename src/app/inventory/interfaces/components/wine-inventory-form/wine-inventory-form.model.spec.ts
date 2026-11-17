import { WineInventoryFormModel } from './wine-inventory-form.model';

describe('Purpose-specific inventory form model', () => {
  it('permits a minimal create with explicit zero quantity and trimmed name', () => {
    const model = new WineInventoryFormModel();
    model.setPurpose('COLLECTOR');
    model.form.patchValue({ name: ' Reserva ', quantity: 0 });
    expect(model.form.valid).toBe(true);
    expect(model.payload()).toEqual({ name: 'Reserva', quantity: 0 });
  });

  for (const purpose of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`patches only changed visible fields in ${purpose}, preserving hidden values`, () => {
      const model = new WineInventoryFormModel({ name: 'Reserva', quantity: 0, vintage: '2020', salePrice: '25.00', supplierName: 'Supplier', rating: '88.00', aromaTags: ['oak'], wouldBuyAgain: false, purchasePrice: '19.99', ageYears: 3 });
      model.setPurpose(purpose);
      model.form.controls['purchasePrice'].setValue('15.50');
      if (purpose === 'COLLECTOR') model.form.controls['aromaTags'].setValue([]);
      else model.form.controls['supplierName'].setValue(null);
      expect(model.payload()).toEqual(purpose === 'COLLECTOR' ? { purchasePrice: '15.50', aromaTags: [] } : { purchasePrice: '15.50', supplierName: null });
      expect(model.payload()).not.toHaveProperty('ageYears');
    });
  }

  it('emits no update for unchanged null, false, zero and empty arrays', () => {
    const model = new WineInventoryFormModel({ name: 'Reserva', quantity: 0, bodySlider: '0.00', wouldBuyAgain: false, aromaTags: [] });
    model.setPurpose('COLLECTOR');
    expect(model.payload()).toEqual({});
  });

  it('validates rating/sliders, decimals, vintage, dates and nonnegative integer quantities', () => {
    const model = new WineInventoryFormModel();
    model.setPurpose('COLLECTOR');
    model.form.patchValue({ name: 'Reserva', quantity: 1 });
    for (const [key, value] of [['rating', '0'], ['rating', '101'], ['bodySlider', '5.01'], ['alcoholPercentage', '101'], ['purchasePrice', '2.123'], ['vintage', '20'], ['quantity', 1.5], ['purchaseDate', '2026-02-30']] as const) {
      const control = model.form.controls[key];
      control.setValue(value);
      expect(control.invalid).toBe(true);
      control.setValue(key === 'quantity' ? 0 : null);
    }
    model.form.patchValue({ vintage: 'NV', rating: '100.00', bodySlider: '0.00', aciditySlider: '4.50', purchaseDate: '2026-11-16', wouldBuyAgain: false });
    expect(model.form.valid).toBe(true);
    expect(model.payload()).toEqual(expect.objectContaining({ quantity: 0, vintage: 'NV', rating: '100.00', bodySlider: '0.00', wouldBuyAgain: false }));
  });

  it('keeps draft values across purpose changes and updates validation without clearing them', () => {
    const model = new WineInventoryFormModel();
    model.setPurpose('BUSINESS');
    model.form.patchValue({ name: 'Reserva', salePrice: 'invalid', supplierName: 'Estate', occasionNotes: 'Pair with fish' });
    expect(model.form.invalid).toBe(true);
    model.setPurpose('COLLECTOR');
    expect(model.form.valid).toBe(true);
    expect(model.payload()).not.toHaveProperty('salePrice');
    expect(model.form.controls['salePrice'].value).toBe('invalid');
    model.setPurpose('BUSINESS');
    expect(model.form.invalid).toBe(true);
    expect(model.visibleFields.find(f => f.key === 'occasionNotes')?.label).toBe('Argumento de venta rápido');
    expect(model.form.controls['supplierName'].value).toBe('Estate');
  });

  it('retains independent aroma strings, including commas, rather than treating tags as CSV', () => {
    const model = new WineInventoryFormModel();
    model.setPurpose('BUSINESS');
    model.tagDraft = ' red fruit, fresh ';
    model.addTag();
    expect(model.tags).toEqual(['red fruit, fresh']);
    expect(model.payload()).toEqual(expect.objectContaining({ aromaTags: ['red fruit, fresh'] }));
  });
});
