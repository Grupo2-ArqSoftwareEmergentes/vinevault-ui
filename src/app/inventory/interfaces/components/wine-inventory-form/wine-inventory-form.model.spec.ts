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
      model.form.controls['aromaTags'].setValue(null);
      if (purpose === 'BUSINESS') model.form.controls['supplierName'].setValue(null);
      expect(model.payload()).toEqual(purpose === 'COLLECTOR' ? { purchasePrice: '15.50' } : { purchasePrice: '15.50', supplierName: null });
      expect(model.payload()).not.toHaveProperty('ageYears');
    });
  }

  it('emits no update for unchanged null, false, zero and empty arrays', () => {
    const model = new WineInventoryFormModel({ name: 'Reserva', quantity: 0, bodySlider: '0.00', wouldBuyAgain: false, aromaTags: [] });
    model.setPurpose('COLLECTOR');
    expect(model.payload()).toEqual({});
  });

  it('validates visible decimals, vintage, dates and quantities without requiring legacy metrics', () => {
    const model = new WineInventoryFormModel();
    model.setPurpose('COLLECTOR');
    model.form.patchValue({ name: 'Reserva', quantity: 1 });
    for (const [key, value] of [['alcoholPercentage', '101'], ['purchasePrice', '2.123'], ['vintage', '20'], ['quantity', 1.5], ['purchaseDate', '2026-02-30']] as const) {
      const control = model.form.controls[key];
      control.setValue(value);
      expect(control.invalid).toBe(true);
      control.setValue(key === 'quantity' ? 0 : null);
    }
    model.form.patchValue({ vintage: 'NV', rating: 'invalid legacy rating', bodySlider: 'out of range', aciditySlider: '4.50', purchaseDate: '2026-11-16', wouldBuyAgain: false });
    expect(model.form.valid).toBe(true);
    expect(model.payload()).toEqual({ name: 'Reserva', quantity: 0, vintage: 'NV', purchaseDate: '2026-11-16', wouldBuyAgain: false });
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

  for (const purpose of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`keeps independent notes, hidden metrics and false in ${purpose}`, () => {
      const model = new WineInventoryFormModel({ name: 'Reserva', quantity: 1, occasionNotes: 'Cena', tastingNotes: 'Frutal', companyNotes: 'Servir por copa', wouldBuyAgain: true,
        rating: '88.00', bodySlider: '0.00', aciditySlider: '4.50', tanninsSlider: '2.00', aromaTags: ['oak'] });
      model.setPurpose(purpose);
      expect(model.visibleFields.find(field => field.key === 'tastingNotes')?.label).toBe('Notas de cata');
      expect(model.visibleFields.find(field => field.key === 'companyNotes')?.label).toBe('Notas internas');
      expect(model.payload()).toEqual({});
      model.clear('tastingNotes');
      model.form.controls['wouldBuyAgain'].setValue(false);
      expect(model.payload()).toEqual({ tastingNotes: null, wouldBuyAgain: false });
      expect(model.form.controls['occasionNotes'].value).toBe('Cena');
      for (const key of ['rating', 'bodySlider', 'aciditySlider', 'tanninsSlider', 'aromaTags']) {
        expect(model.visibleFields.some(field => field.key === key)).toBe(false);
        expect(model.payload()).not.toHaveProperty(key);
      }
      model.clear('companyNotes');
      model.clear('wouldBuyAgain');
      expect(model.payload()).toEqual({ tastingNotes: null, companyNotes: null, wouldBuyAgain: null });
    });
  }

  it('does not copy old notes and validates new optional tasting notes up to 4000 characters', () => {
    const model = new WineInventoryFormModel({ name: 'Reserva', quantity: 1, occasionNotes: 'Notas anteriores' });
    model.setPurpose('COLLECTOR');
    const control = model.form.controls['tastingNotes'];
    expect(control.value).toBeNull();
    expect(model.payload()).toEqual({});
    control.setValue('x'.repeat(4000));
    expect(control.valid).toBe(true);
    control.setValue('x'.repeat(4001));
    expect(control.invalid).toBe(true);
    control.setValue(' Frutal y equilibrado ');
    expect(model.payload()).toEqual({ tastingNotes: 'Frutal y equilibrado' });
  });

  it('validates consumption year bounds without rewriting existing free-text windows', () => {
    const model = new WineInventoryFormModel({ name: 'Reserva', quantity: 1, consumptionWindow: 'Al descorchar' });
    model.setPurpose('COLLECTOR');
    expect(model.form.valid).toBe(true);
    expect(model.payload()).toEqual({});
    const control = model.form.controls['consumptionWindow'];
    for (const invalid of ['202 – 2030', '2030 – 2026']) {
      control.setValue(invalid);
      expect(control.invalid).toBe(true);
    }
    control.setValue('2026 – 2030');
    expect(control.valid).toBe(true);
    expect(model.payload()).toEqual({ consumptionWindow: '2026 – 2030' });
  });
});
