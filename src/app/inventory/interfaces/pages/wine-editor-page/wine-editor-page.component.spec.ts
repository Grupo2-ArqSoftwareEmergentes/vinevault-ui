import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WineEditorPageComponent } from './wine-editor-page.component';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { WorkspaceApiService } from '../../../../shared/services/workspace-api.service';
import { ownerAccess, enabledPlanFeatures } from '../../../../shared/testing/workspace.fixtures';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { WineInventoryItemQueryServiceImpl } from '../../../application/internal/queryservices/wine-inventory-item-query-service.impl';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { WineInventoryItem } from '../../../domain/services/wine-inventory-item-query-service';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { createWineCellarId } from '../../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { createWineInventoryItemId } from '../../../domain/model/valueobjects/wine-inventory-item-id.value-object';
import { InventoryApiService, WineAiAutocompleteResponse } from '../../../infrastructure/api/inventory-api.service';
import { HttpErrorResponse } from '@angular/common/http';

const space = { ...ownerAccess, id: createSpaceId('space-1'), name: 'Collection' };
const business = { ...space, id: createSpaceId('space-2'), name: 'Restaurant', spaceType: 'BUSINESS' as const };
const cellar = { id: createWineCellarId('cellar-1'), spaceId: space.id, name: 'Principal' };
const cellar2 = { id: createWineCellarId('cellar-2'), spaceId: business.id, name: 'Restaurant cellar' };
const item: WineInventoryItem = {
  id: createWineInventoryItemId('item-1'), wineCellarId: cellar.id, name: 'Reserva', quantity: 3,
  purchasePrice: '19.99', salePrice: '29.99', supplierName: 'Hidden supplier', bodySlider: '0.00',
  vintage: 'NV', rating: '88.00', tastingNotes: 'Frutal', occasionNotes: 'Cena', companyNotes: 'Servir frío', wouldBuyAgain: false, createdAt: null, updatedAt: null,
};

describe('Full-page wine editor', () => {
  let fixture: ComponentFixture<WineEditorPageComponent>;
  let workspace: WorkspaceContextService;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const create = vi.fn();
  const patch = vi.fn();
  const load = vi.fn();
  const autocomplete = vi.fn();

  beforeEach(() => {
    create.mockReset().mockReturnValue(of(item));
    patch.mockReset().mockReturnValue(of(item));
    load.mockReset().mockReturnValue(of([item]));
    autocomplete.mockReset().mockReturnValue(of({}));
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({ imports: [WineEditorPageComponent], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { queryParamMap: convertToParamMap({ spaceId: 'space-1', wineCellarId: 'cellar-1' }) } } },
      { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [space, business], cellars: [cellar, cellar2] }) } },
      { provide: WineInventoryItemQueryServiceImpl, useValue: { getInventoryItemsByWineCellar: load } },
      { provide: WineInventoryItemCommandServiceImpl, useValue: { createInventoryItem: create, updateInventoryItem: patch } },
      { provide: InventoryApiService, useValue: { autocompleteWine: autocomplete } },
    ] });
    workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    workspace.chooseCellar('cellar-1', false);
    vi.spyOn(TestBed.inject(WorkspaceAccessService), 'capabilities').mockReturnValue(enabledPlanFeatures);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => vi.restoreAllMocks());

  async function render(edit = false) {
    if (edit) params.next(convertToParamMap({ id: 'item-1' }));
    fixture = TestBed.createComponent(WineEditorPageComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('renders four connected tab panels with exact labels and contextual return navigation', async () => {
    await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(Array.from(element.querySelectorAll('[role="tab"]')).map(tab => tab.querySelector('span:nth-child(2)')?.textContent)).toEqual(['Identificación', 'Costo y origen', 'Ficha enológica', 'Cata']);
    expect(element.querySelectorAll('[role="tabpanel"]')).toHaveLength(4);
    expect(element.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
    expect(element.querySelectorAll('details')).toHaveLength(0);
    expect(element.querySelector('mat-dialog-content')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toContain('Añadir vino');
    expect(element.querySelector('.back-link')?.getAttribute('href')).toBe('/inventory?spaceId=space-1&wineCellarId=cellar-1');
    expect(element.querySelector('[data-field="name"]')).toBeTruthy();
    expect(element.querySelector('[data-field="quantity"]')).toBeTruthy();
    expect(element.querySelector('[data-field="salePrice"]')).toBeNull();
    expect(element.querySelector('[data-field="originType"]')).toBeTruthy();
    expect(element.querySelector('input[type="range"], #wine-rating, #wine-aromaTags')).toBeNull();
    expect(element.querySelector('[data-field="tastingNotes"] label')?.textContent).toBe('Notas de cata');
    expect(element.querySelector('[data-field="companyNotes"] label')?.textContent).toBe('Notas internas');
  });

  it('keeps grouped safe-footer controls in the form and cancels without submitting the draft', async () => {
    await render();
    const footer = fixture.nativeElement.querySelector('form > .assistant-safe-actions') as HTMLElement;
    const cancel = footer.querySelector('.editor-action-buttons .secondary') as HTMLButtonElement;
    const save = footer.querySelector('.editor-action-buttons .save-wine') as HTMLButtonElement;
    expect(cancel.type).toBe('button');
    expect(save.type).toBe('submit');
    expect(save.form).toBe(fixture.nativeElement.querySelector('form'));
    cancel.click();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/inventory'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
    expect(create).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('does not autocomplete or discard draft data when the selected plan lacks the feature', async () => {
    const component = await render();
    vi.spyOn(TestBed.inject(WorkspaceAccessService), 'capabilities').mockReturnValue({ autocomplete: false });
    component.model.form.controls['name'].setValue('Reserva');
    component.autocompleteWine();
    expect(component.canAutocomplete).toBe(false);
    expect(autocomplete).not.toHaveBeenCalled();
    expect(component.model.form.controls['name'].value).toBe('Reserva');
  });

  it('keeps the same form and all draft values through all four tabs, and saves from Cata', async () => {
    const component = await render();
    const form = component.model.form;
    form.patchValue({ name: 'Draft', purchasePrice: '12.50', country: 'Perú', tastingNotes: 'Frutal', wouldBuyAgain: false });
    const buttons = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#wine-panel-1').hidden).toBe(false);
    buttons[2].click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#wine-panel-2').hidden).toBe(false);
    buttons[3].click();
    await fixture.whenStable();
    expect(component.model.form).toBe(form);
    expect(form.controls['name'].value).toBe('Draft');
    expect(form.controls['country'].value).toBe('Perú');
    expect(fixture.nativeElement.querySelectorAll('.data-dot')).toHaveLength(3);
    fixture.nativeElement.querySelector('.save-wine').click();
    expect(create).toHaveBeenCalledWith('cellar-1', { name: 'Draft', quantity: 1, purchasePrice: '12.50', country: 'Perú', tastingNotes: 'Frutal', wouldBuyAgain: false });
  });

  for (const tab of [1, 2, 3]) {
    it(`returns to required fields on invalid submit from tab ${tab + 1} and marks and focuses the error`, async () => {
      const component = await render();
      component.selectTab(tab);
      await fixture.whenStable();
      const submit = fixture.nativeElement.querySelector('.save-wine') as HTMLButtonElement;
      expect(submit.disabled).toBe(false);
      submit.click();
      await fixture.whenStable();
      expect(component.activeTab).toBe(0);
      expect(component.model.form.controls['name'].touched).toBe(true);
      expect(document.activeElement?.id).toBe('wine-name');
      expect(fixture.nativeElement.querySelector('#wine-error-name').textContent).toContain('Introduce un nombre');
      expect(create).not.toHaveBeenCalled();
    });
  }

  for (const purpose of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`isolates the five identification fields from ${purpose} costs and retains all technical/tasting fields`, async () => {
      if (purpose === 'BUSINESS') workspace.chooseCellar('cellar-2', false);
      const component = await render();
      const keys = (panel: number) => Array.from(fixture.nativeElement.querySelectorAll(`#wine-panel-${panel} [data-field]`) as NodeListOf<HTMLElement>).map(field => field.dataset['field']);
      expect(keys(0)).toEqual(['name', 'quantity', 'winery', 'vintage', 'physicalLocation']);
      expect(keys(1)).toEqual(purpose === 'COLLECTOR'
        ? ['purchasePrice', 'originType', 'purchaseDate']
        : ['purchasePrice', 'salePrice', 'minStockAlert', 'supplierName', 'batchInvoiceNumber']);
      expect(keys(2)).toHaveLength(8);
      expect(keys(3)).toEqual(['tastingNotes', 'occasionNotes', 'companyNotes', 'wouldBuyAgain']);
      component.model.form.patchValue({ name: 'Vino', quantity: null });
      component.selectTab(3);
      component.save();
      expect(component.activeTab).toBe(0);
      expect(component.model.form.controls['quantity'].touched).toBe(true);
      expect(create).not.toHaveBeenCalled();
    });
  }

  it('opens the tab with an invalid optional field rather than silently blocking a save', async () => {
    const component = await render();
    component.model.form.patchValue({ name: 'Valid name', alcoholPercentage: '101' });
    component.save();
    await fixture.whenStable();
    expect(component.activeTab).toBe(2);
    expect(document.activeElement?.id).toBe('wine-alcoholPercentage');
    expect(create).not.toHaveBeenCalled();
  });

  it('supports roving keyboard focus with arrows, Home and End', async () => {
    const component = await render();
    const first = fixture.nativeElement.querySelector('#wine-tab-0') as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(component.activeTab).toBe(1);
    expect(document.activeElement?.id).toBe('wine-tab-1');
    expect(fixture.nativeElement.querySelector('#wine-tab-0').tabIndex).toBe(-1);
    component.onTabKeydown(new KeyboardEvent('keydown', { key: 'End' }), 1);
    expect(component.activeTab).toBe(3);
    component.onTabKeydown(new KeyboardEvent('keydown', { key: 'Home' }), 3);
    expect(component.activeTab).toBe(0);
    component.onTabKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }), 0);
    expect(component.activeTab).toBe(3);
  });

  it('shows optional-data dots for zero and false, but not hidden legacy metrics', async () => {
    const component = await render();
    expect(component.tabHasData(1)).toBe(false);
    expect(component.tabHasData(3)).toBe(false);
    component.model.form.patchValue({ bodySlider: '0', aromaTags: ['oak'] });
    expect(component.tabHasData(3)).toBe(false);
    component.model.form.controls['wouldBuyAgain'].setValue(false);
    expect(component.tabHasData(3)).toBe(true);
    component.model.form.patchValue({ bodySlider: null, wouldBuyAgain: null, aromaTags: [] });
    expect(component.tabHasData(3)).toBe(false);
    component.model.form.controls['country'].setValue('Perú');
    expect(component.tabHasData(2)).toBe(true);
    component.model.form.controls['purchasePrice'].setValue('0');
    expect(component.tabHasData(1)).toBe(true);
  });

  it('clears tasting notes explicitly without overwriting previous notes, false or hidden metrics', async () => {
    const component = await render(true);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('Borrar valor');
    expect(element.querySelector('[data-field="country"] .clear-input')).toBeNull();
    expect(element.querySelector('[data-field="wouldBuyAgain"] .clear-input')).not.toBeNull();
    (element.querySelector('[data-field="purchasePrice"] .clear-input') as HTMLButtonElement).click();
    component.selectTab(3);
    await fixture.whenStable();
    (element.querySelector('[data-field="tastingNotes"] .clear-input') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelector('[data-field="tastingNotes"] .clear-input')).toBeNull();
    expect(component.model.payload()).toEqual({ purchasePrice: null, tastingNotes: null });
    expect(component.model.form.controls['occasionNotes'].value).toBe('Cena');
    expect(component.model.form.controls['wouldBuyAgain'].value).toBe(false);
    component.save();
    expect(patch).toHaveBeenCalledWith('cellar-1', 'item-1', { purchasePrice: null, tastingNotes: null });
  });

  it('creates from Cata using independent optional notes and a nullable boolean without metrics', async () => {
    const component = await render();
    component.selectTab(3);
    await fixture.whenStable();
    component.model.form.controls['name'].setValue('Reserva');
    const notes = fixture.nativeElement.querySelector('#wine-tastingNotes') as HTMLTextAreaElement;
    notes.value = 'Frutal y equilibrado';
    notes.dispatchEvent(new Event('input', { bubbles: true }));
    const wouldBuy = fixture.nativeElement.querySelector('#wine-wouldBuyAgain') as HTMLSelectElement;
    wouldBuy.selectedIndex = 2; // No (false), distinct from the nullable first option.
    wouldBuy.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    expect(component.model.form.controls['tastingNotes'].value).toBe('Frutal y equilibrado');
    expect(component.model.form.controls['wouldBuyAgain'].value).toBe(false);
    component.save();
    expect(create).toHaveBeenCalledWith('cellar-1', { name: 'Reserva', quantity: 1, tastingNotes: 'Frutal y equilibrado', wouldBuyAgain: false });
  });

  it('maps the consumption bounds to the existing single string and preserves legacy free text until edited', async () => {
    const component = await render(true);
    component.selectTab(2);
    await fixture.whenStable();
    const from = fixture.nativeElement.querySelector('#wine-consumptionWindow') as HTMLInputElement;
    from.value = '2026';
    from.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    const until = fixture.nativeElement.querySelector('#wine-consumptionWindow-until') as HTMLInputElement;
    until.value = '2030';
    until.dispatchEvent(new Event('input', { bubbles: true }));
    expect(component.model.payload()).toEqual({ consumptionWindow: '2026 – 2030' });
    component.model.form.controls['consumptionWindow'].setValue('Después de decantar');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#wine-consumptionWindow').value).toBe('Después de decantar');
    expect(fixture.nativeElement.textContent).toContain('Valor existente conservado');
  });

  it('only requests AI on demand, validates name length and prevents duplicate pending requests without locking editing', async () => {
    const pending = new Subject<WineAiAutocompleteResponse>();
    autocomplete.mockReturnValue(pending);
    const component = await render();
    const button = fixture.nativeElement.querySelector('.ai-autocomplete') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    component.model.form.controls['name'].setValue('ab');
    component.autocompleteWine();
    expect(autocomplete).not.toHaveBeenCalled();
    component.model.form.controls['name'].setValue(' Reserva ');
    await fixture.whenStable();
    expect(autocomplete).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    button.click();
    component.autocompleteWine();
    await fixture.whenStable();
    expect(autocomplete).toHaveBeenCalledExactlyOnceWith('Reserva');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Consultando...');
    expect(component.canEditForm).toBe(true);
    pending.next({ winery: 'Bodega sugerida' });
    expect(component.model.form.controls['winery'].value).toBe('Bodega sugerida');
    expect(component.isAutocompleting).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    component.model.form.controls['name'].setValue('x'.repeat(256));
    expect(component.canAutocomplete).toBe(false);
  });

  for (const edit of [false, true]) {
    it(`fills only currently empty fields on ${edit ? 'edit' : 'create'}, leaving every Cata control untouched`, async () => {
      const pending = new Subject<WineAiAutocompleteResponse>();
      autocomplete.mockReturnValue(pending);
      const component = await render(edit);
      component.model.form.patchValue({ name: 'Reserva', winery: 'Mi bodega', country: null, tastingNotes: 'Mis notas', companyNotes: 'Internas', wouldBuyAgain: false });
      const tastingFields = ['tastingNotes', 'occasionNotes', 'companyNotes', 'wouldBuyAgain', 'rating', 'bodySlider', 'aciditySlider', 'tanninsSlider', 'aromaTags'];
      const tasting = () => tastingFields.map(key => { const control = component.model.form.controls[key]; return { value: control.value, touched: control.touched, dirty: control.dirty }; });
      const before = tasting();
      component.autocompleteWine();
      component.model.form.controls['country'].setValue('Perú escrito durante la espera');
      const response = { winery: 'Otra bodega', country: 'España', region: 'Rioja', denomination: 'DOCa', grape_type: 'Tempranillo', format: '750 ml', aging: 'Roble', alcohol: '14.5 %', drinking_window_start: 2026, drinking_window_end: 2032, tastingNotes: 'No aplicar', companyNotes: null, wouldBuyAgain: true };
      pending.next(response);
      expect(component.model.form.controls['winery'].value).toBe('Mi bodega');
      expect(component.model.form.controls['country'].value).toBe('Perú escrito durante la espera');
      expect(component.model.form.controls['region'].value).toBe('Rioja');
      expect(component.model.form.controls['appellation'].value).toBe('DOCa');
      expect(component.model.form.controls['wineType'].value).toBe('Tempranillo');
      expect(component.model.form.controls['bottleFormat'].value).toBe('750 ml');
      expect(component.model.form.controls['alcoholPercentage'].value).toBe('14.5');
      expect(component.model.form.controls['consumptionWindow'].value).toBe('2026–2032');
      expect(component.model.form.controls['region'].dirty).toBe(true);
      expect(tasting()).toEqual(before);
      expect(create).not.toHaveBeenCalled();
      expect(patch).not.toHaveBeenCalled();
    });
  }

  it('silently cancels a stale name response even if the user then restores the original name', async () => {
    const pending = new Subject<WineAiAutocompleteResponse>();
    autocomplete.mockReturnValue(pending);
    const component = await render();
    component.model.form.controls['name'].setValue('Reserva');
    component.autocompleteWine();
    component.model.form.controls['name'].setValue('Otro vino');
    component.model.form.controls['name'].setValue('Reserva');
    pending.next({ country: 'No aplicar' });
    expect(component.model.form.controls['country'].value).toBeNull();
    expect(component.autocompleteNotice).toBe('');
    expect(component.isAutocompleting).toBe(false);
    expect(autocomplete).toHaveBeenCalledOnce();
  });

  for (const response of [{}, { winery: null, country: ' ', alcohol: '%' }]) {
    it(`offers manual entry for empty AI data ${JSON.stringify(response)} without retrying`, async () => {
      autocomplete.mockReturnValue(of(response));
      const component = await render();
      component.model.form.controls['name'].setValue('Reserva');
      component.autocompleteWine();
      expect(component.autocompleteNotice).toBe('No encontramos datos suficientes. Puedes completarlos manualmente.');
      expect(autocomplete).toHaveBeenCalledOnce();
      expect(component.canSave).toBe(true);
    });
  }

  it('preserves nonempty values when every suggestion conflicts and never clears them with null/empty data', async () => {
    autocomplete.mockReturnValue(of({ winery: 'Otra bodega', country: null, region: '' }));
    const component = await render();
    component.model.form.patchValue({ name: 'Reserva', winery: 'Mi bodega', country: 'Perú', region: 'Ica' });
    component.autocompleteWine();
    expect(component.autocompleteNotice).toContain('No había campos vacíos');
    expect(component.model.form.controls['winery'].value).toBe('Mi bodega');
    expect(component.model.form.controls['country'].value).toBe('Perú');
    expect(component.model.form.controls['region'].value).toBe('Ica');
  });

  for (const status of [0, 401, 403, 422, 500]) {
    it(`handles AI HTTP ${status} without blocking manual editing, retrying or losing data`, async () => {
      autocomplete.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
      const component = await render();
      component.model.form.patchValue({ name: 'Reserva', tastingNotes: 'Mis notas' });
      component.autocompleteWine();
      expect(component.autocompleteNotice).toBe(status === 401 ? '' : status === 403
        ? 'Esta función requiere una membresía con permiso de análisis.' : status === 422
          ? 'Revisa el nombre del vino (obligatorio, máximo 255 caracteres).'
          : 'No pudimos conectar con el asistente. Puedes continuar editando manualmente e intentarlo más tarde.');
      expect(component.model.form.controls['tastingNotes'].value).toBe('Mis notas');
      expect(component.canSave).toBe(true);
      expect(component.isAutocompleting).toBe(false);
      expect(autocomplete).toHaveBeenCalledOnce();
      expect(create).not.toHaveBeenCalled();
    });
  }

  for (const action of ['destroy', 'context', 'route', 'save', 'cancel'] as const) {
    it(`discards pending AI suggestions on ${action}`, async () => {
      const pending = new Subject<WineAiAutocompleteResponse>();
      autocomplete.mockReturnValue(pending);
      const component = await render();
      component.model.form.controls['name'].setValue('Reserva');
      const original = component.model;
      component.autocompleteWine();
      if (action === 'destroy') fixture.destroy();
      else if (action === 'context') workspace.chooseCellar('cellar-2', false);
      else if (action === 'route') params.next(convertToParamMap({ id: 'item-1' }));
      else if (action === 'save') component.save();
      else component.returnToInventory();
      pending.next({ country: 'No aplicar' });
      expect(original.form.controls['country'].value).toBeNull();
      expect(component.isAutocompleting).toBe(false);
    });
  }

  it('creates once in the active cellar, locks the form while saving and returns to freshly mounted inventory', async () => {
    const pending = new Subject<WineInventoryItem>();
    create.mockReturnValue(pending);
    const component = await render();
    component.model.form.patchValue({ name: ' Reserva personal ', quantity: 0 });
    component.save();
    component.save();
    component.returnToInventory();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledExactlyOnceWith('cellar-1', { name: 'Reserva personal', quantity: 0 });
    expect(component.model.form.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.save-wine').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('footer .secondary').disabled).toBe(true);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    pending.next(item);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/inventory'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
    expect(component.saving).toBe(false);
    expect(component.model.form.enabled).toBe(true);
  });

  it('adapts fields, labels and validation when changing spaces and preserves hidden draft values', async () => {
    const component = await render();
    component.model.form.patchValue({ name: 'Draft', purchasePrice: '15.50' });
    workspace.chooseCellar('cellar-2', false);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#wine-tasting-title').textContent).toBe('Guía de Venta y Cata');
    expect(fixture.nativeElement.querySelector('[data-field="salePrice"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-field="originType"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Costo unitario');
    expect(fixture.nativeElement.textContent).toContain('Argumento de venta rápido');
    component.model.form.controls['salePrice'].setValue('invalid');
    expect(component.model.form.invalid).toBe(true);
    workspace.chooseCellar('cellar-1', false);
    await fixture.whenStable();
    expect(component.model.form.valid).toBe(true);
    expect(component.model.form.controls['salePrice'].value).toBe('invalid');
    expect(component.model.form.controls['purchasePrice'].value).toBe('15.50');
    workspace.chooseCellar('cellar-2', false);
    component.model.form.controls['salePrice'].setValue('29.99');
    component.save();
    expect(create).toHaveBeenCalledExactlyOnceWith('cellar-2', { name: 'Draft', quantity: 1, purchasePrice: '15.50', salePrice: '29.99' });
  });

  it('loads an edit deep link and PATCHes only modified fields, not hidden business values', async () => {
    const component = await render(true);
    expect(load).toHaveBeenCalledExactlyOnceWith('cellar-1');
    expect(component.loadedItem).toBe(true);
    expect(component.model.form.controls['name'].value).toBe('Reserva');
    component.model.form.controls['purchasePrice'].setValue('15.50');
    component.save();
    expect(patch).toHaveBeenCalledExactlyOnceWith('cellar-1', 'item-1', { purchasePrice: '15.50' });
    expect(create).not.toHaveBeenCalled();
  });

  it('blocks cross-cellar edit saves without losing the draft and permits returning to its original context', async () => {
    const component = await render(true);
    component.model.form.controls['name'].setValue('Edited draft');
    workspace.chooseCellar('cellar-2', false);
    await fixture.whenStable();
    expect(component.contextMismatch).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Este vino pertenece a otra cava');
    component.save();
    expect(patch).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(component.model.form.controls['name'].value).toBe('Edited draft');
    workspace.chooseCellar('cellar-1', false);
    component.save();
    expect(patch).toHaveBeenCalledWith('cellar-1', 'item-1', { name: 'Edited draft' });
  });

  it('cancels an in-flight save on context change without retrying or navigating to the wrong inventory', async () => {
    const pending = new Subject<WineInventoryItem>();
    create.mockReturnValue(pending);
    const component = await render();
    component.model.form.controls['name'].setValue('Draft');
    component.save();
    workspace.chooseCellar('cellar-2', false);
    pending.next(item);
    component.save();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledOnce();
    expect(component.saving).toBe(false);
    expect(component.uncertainSave).toBe(true);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('keeps inputs and allows deliberate retry after a failed save', async () => {
    create.mockReturnValue(throwError(() => new Error('Offline')));
    const component = await render();
    component.model.form.controls['name'].setValue('Draft');
    component.save();
    await fixture.whenStable();
    expect(component.error).toBeTruthy();
    expect(component.model.form.controls['name'].value).toBe('Draft');
    expect(component.saving).toBe(false);
    expect(component.model.form.enabled).toBe(true);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('rejects missing items, invalid values, missing context and read-only roles', async () => {
    load.mockReturnValue(of([]));
    const component = await render(true);
    expect(component.error).toContain('No se encontró');
    component.save();
    expect(patch).not.toHaveBeenCalled();
    params.next(convertToParamMap({}));
    component.model.form.patchValue({ name: ' ', quantity: -1 });
    component.save();
    expect(create).not.toHaveBeenCalled();
    component.model.form.patchValue({ name: 'Wine', quantity: 1 });
    TestBed.inject(WorkspaceScopeService).activate({ ...space, role: 'WAITER' });
    component.save();
    expect(create).not.toHaveBeenCalled();
    workspace.clearSelection();
    component.save();
    expect(create).not.toHaveBeenCalled();
  });

  it('cancel returns to inventory without mutations; an unchanged edit does the same', async () => {
    const component = await render(true);
    component.save();
    component.returnToInventory();
    expect(create).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/inventory'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
  });

  it('blocks Collector creates using whole-space bottle usage and keeps inputs editable for correction', async () => {
    workspace.spaces.update(spaces => spaces.map(s => s.id.value === space.id.value ? {
      ...s, quotas: { cellars: { used: 2, limit: 2, remaining: 0 }, bottles: { used: 49, limit: 50, remaining: 1 }, skus: { used: 10, limit: null, remaining: null } },
    } : s));
    workspace.chooseCellar('cellar-1', false);
    const component = await render();
    component.model.form.patchValue({ name: 'New wine', quantity: 2 });
    component.save();
    await fixture.whenStable();
    expect(create).not.toHaveBeenCalled();
    expect(component.canEditForm).toBe(true);
    expect(component.quotaProjection?.projected).toBe(51);
    expect(fixture.nativeElement.textContent).toContain('Botellas proyectadas en todo el espacio');
    expect(fixture.nativeElement.querySelector('.save-wine').disabled).toBe(true);
    component.model.form.controls['quantity'].setValue(1);
    component.save();
    expect(create).toHaveBeenCalledWith('cellar-1', { name: 'New wine', quantity: 1 });
  });

  it('subtracts the original Collector quantity from total used when editing', async () => {
    workspace.spaces.update(spaces => spaces.map(s => s.id.value === space.id.value ? {
      ...s, quotas: { cellars: { used: 2, limit: 2, remaining: 0 }, bottles: { used: 50, limit: 50, remaining: 0 }, skus: { used: 10, limit: null, remaining: null } },
    } : s));
    workspace.chooseCellar('cellar-1', false);
    const component = await render(true);
    component.model.form.controls['quantity'].setValue(4);
    component.save();
    expect(component.quotaProjection?.projected).toBe(51);
    expect(patch).not.toHaveBeenCalled();
    component.model.form.controls['quantity'].setValue(2);
    component.save();
    expect(patch).toHaveBeenCalledWith('cellar-1', 'item-1', { quantity: 2 });
  });

  it('disallows a zero-stock Business SKU at the limit without blocking existing-SKU edits', async () => {
    workspace.spaces.update(spaces => spaces.map(s => ({ ...s, spaceType: 'BUSINESS' as const,
      quotas: { cellars: { used: 1, limit: 1, remaining: 0 }, bottles: { used: 0, limit: null, remaining: null }, skus: { used: 25, limit: 25, remaining: 0 } },
    })));
    workspace.chooseCellar('cellar-1', false);
    const component = await render();
    component.model.form.patchValue({ name: 'Duplicate name', quantity: 0 });
    component.save();
    expect(component.quotaProjection?.projected).toBe(26);
    expect(create).not.toHaveBeenCalled();
    params.next(convertToParamMap({ id: 'item-1' }));
    component.model.form.controls['quantity'].setValue(0);
    expect(component.quotaProjection?.projected).toBe(25);
    component.save();
    expect(patch).toHaveBeenCalledWith('cellar-1', 'item-1', { quantity: 0 });
  });
});
