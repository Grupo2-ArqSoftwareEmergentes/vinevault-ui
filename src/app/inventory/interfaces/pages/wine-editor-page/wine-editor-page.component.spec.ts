import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WineEditorPageComponent } from './wine-editor-page.component';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { WorkspaceApiService } from '../../../../shared/services/workspace-api.service';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';
import { WineInventoryItemQueryServiceImpl } from '../../../application/internal/queryservices/wine-inventory-item-query-service.impl';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { WineInventoryItem } from '../../../domain/services/wine-inventory-item-query-service';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { createWineCellarId } from '../../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { createWineInventoryItemId } from '../../../domain/model/valueobjects/wine-inventory-item-id.value-object';

const space = { ...ownerAccess, id: createSpaceId('space-1'), name: 'Collection' };
const business = { ...space, id: createSpaceId('space-2'), name: 'Restaurant', spaceType: 'BUSINESS' as const };
const cellar = { id: createWineCellarId('cellar-1'), spaceId: space.id, name: 'Principal' };
const cellar2 = { id: createWineCellarId('cellar-2'), spaceId: business.id, name: 'Restaurant cellar' };
const item: WineInventoryItem = {
  id: createWineInventoryItemId('item-1'), wineCellarId: cellar.id, name: 'Reserva', quantity: 3,
  purchasePrice: '19.99', salePrice: '29.99', supplierName: 'Hidden supplier', bodySlider: '0.00',
  vintage: 'NV', rating: '88.00', wouldBuyAgain: false, createdAt: null, updatedAt: null,
};

describe('Full-page wine editor', () => {
  let fixture: ComponentFixture<WineEditorPageComponent>;
  let workspace: WorkspaceContextService;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const create = vi.fn();
  const patch = vi.fn();
  const load = vi.fn();

  beforeEach(() => {
    create.mockReset().mockReturnValue(of(item));
    patch.mockReset().mockReturnValue(of(item));
    load.mockReset().mockReturnValue(of([item]));
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({ imports: [WineEditorPageComponent], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { queryParamMap: convertToParamMap({ spaceId: 'space-1', wineCellarId: 'cellar-1' }) } } },
      { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [space, business], cellars: [cellar, cellar2] }) } },
      { provide: WineInventoryItemQueryServiceImpl, useValue: { getInventoryItemsByWineCellar: load } },
      { provide: WineInventoryItemCommandServiceImpl, useValue: { createInventoryItem: create, updateInventoryItem: patch } },
    ] });
    workspace = TestBed.inject(WorkspaceContextService);
    workspace.ensureLoaded();
    workspace.chooseCellar('cellar-1', false);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => vi.restoreAllMocks());

  async function render(edit = false) {
    if (edit) params.next(convertToParamMap({ id: 'item-1' }));
    fixture = TestBed.createComponent(WineEditorPageComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('renders four independent cards with optional technical/tasting sections and contextual return navigation', async () => {
    await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.editor-card')).toHaveLength(4);
    expect(element.querySelectorAll('details')).toHaveLength(2);
    expect(element.querySelector('mat-dialog-content')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toContain('Add wine');
    expect(element.querySelector('.back-link')?.getAttribute('href')).toBe('/inventory?spaceId=space-1&wineCellarId=cellar-1');
    expect(element.querySelector('[data-field="name"]')).toBeTruthy();
    expect(element.querySelector('[data-field="quantity"]')).toBeTruthy();
    expect(element.querySelector('[data-field="salePrice"]')).toBeNull();
    expect(element.querySelector('[data-field="originType"]')).toBeTruthy();
    expect(element.querySelector('input[type="range"]')).toBeTruthy();
  });

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
});
