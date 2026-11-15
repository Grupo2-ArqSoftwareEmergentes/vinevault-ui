import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { InventorySelectionPanelComponent } from './inventory-selection-panel/inventory-selection-panel.component';
import { AddWineInventoryItemDialogComponent } from './add-wine-inventory-item-dialog/add-wine-inventory-item-dialog.component';
import { DEVICE_QUERY_SERVICE, Organization, Space } from '../../../device/domain/services/device-query-service';
import { WineCellarQueryServiceImpl } from '../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellar } from '../../../cava/domain/services/wine-cellar-query-service';
import { WineInventoryItemQueryServiceImpl } from '../../application/internal/queryservices/wine-inventory-item-query-service.impl';
import { WineInventoryItemCommandServiceImpl } from '../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { WineInventoryItem } from '../../domain/services/wine-inventory-item-query-service';
import { InventoryIntelligenceCommandServiceImpl } from '../../../invetory_intelligence/application/internal/commandservices/inventory-intelligence-command-service.impl';
import { createOrganizationId } from '../../../device/domain/model/valueobjects/organization-id.value-object';
import { createSpaceId } from '../../../device/domain/model/valueobjects/space-id.value-object';
import { createUserId } from '../../../device/domain/model/valueobjects/user-id.value-object';
import { createWineCellarId } from '../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { createWineInventoryItemId } from '../../domain/model/valueobjects/wine-inventory-item-id.value-object';

const organization: Organization = { id: createOrganizationId('org-1'), name: 'Estate', ownerUserId: createUserId('user-1'), createdAt: null, updatedAt: null };
const space: Space = { id: createSpaceId('space-1'), name: 'Reserve', organizationId: organization.id, ownerUserId: organization.ownerUserId, createdAt: null, updatedAt: null };
const cellar: WineCellar = { id: createWineCellarId('cellar-1'), spaceId: space.id, name: 'Reserve Cellar', description: null, deviceId: null, createdAt: null, updatedAt: null };
const item: WineInventoryItem = { id: createWineInventoryItemId('item-1'), wineCellarId: cellar.id, wineName: 'Malbec Reserva', wineType: 'Tinto', ageYears: 3, quantity: 12, createdAt: null, updatedAt: null };
const payload = { wineName: item.wineName, wineType: item.wineType, ageYears: item.ageYears, quantity: item.quantity };

describe('Inventory workspace', () => {
  let fixture: ComponentFixture<InventorySelectionPanelComponent>;
  const loadSpaces = vi.fn(() => of([space]));
  const loadCellars = vi.fn(() => of([cellar]));
  const loadItems = vi.fn(() => of([item]));
  const commands = {
    createInventoryItem: vi.fn(() => of(item)),
    updateInventoryItem: vi.fn(() => of(item)),
    deleteInventoryItem: vi.fn(() => of(void 0)),
    getInventoryTemplate: vi.fn(() => of(new HttpResponse<Blob>())),
    getInventoryExport: vi.fn(() => of(new HttpResponse<Blob>())),
    importInventory: vi.fn(() => of({ sheetName: 'Inventory', totalRows: 1, created: 1, updated: 0 })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [InventorySelectionPanelComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: () => of([organization]), handleGetSpacesByOrganization: loadSpaces } },
        { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: loadCellars } },
        { provide: WineInventoryItemQueryServiceImpl, useValue: { getInventoryItemsByWineCellar: loadItems } },
        { provide: WineInventoryItemCommandServiceImpl, useValue: commands },
        { provide: InventoryIntelligenceCommandServiceImpl, useValue: { analyzeStock: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InventorySelectionPanelComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.restoreAllMocks());

  async function choose(selector: string, value: string) {
    const select = fixture.nativeElement.querySelector(selector) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function chooseCellar() {
    await choose('#organization-select', 'org-1');
    await choose('#space-select', 'space-1');
    await choose('#cava-select', 'cellar-1');
  }

  it('retains cascading selection and resets dependent selectors', async () => {
    expect(fixture.nativeElement.querySelector('#space-select').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#cava-select').disabled).toBe(true);
    await chooseCellar();
    expect(loadSpaces).toHaveBeenCalledWith({ organizationId: organization.id });
    expect(loadCellars).toHaveBeenCalledWith('space-1');
    expect(loadItems).toHaveBeenCalledWith('cellar-1');
    await choose('#organization-select', '');
    expect(fixture.componentInstance.selectedSpace).toBeNull();
    expect(fixture.componentInstance.selectedWineCellar).toBeNull();
    expect(fixture.nativeElement.querySelector('.inventory-table')).toBeNull();
  });

  it('renders typed wine pills, numeric cells, and a named keyboard-accessible scroll region', async () => {
    await chooseCellar();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.inventory-table-count')?.textContent).toContain('1 items');
    expect(element.querySelector('.wine-type-pill')?.getAttribute('data-wine-type')).toBe('tinto');
    expect(element.querySelector('.quantity-cell')?.textContent).toBe('12');
    expect(element.querySelector('.inventory-table-wrap')?.getAttribute('tabindex')).toBe('0');
    expect(element.querySelector('.inventory-table-wrap')?.getAttribute('aria-labelledby')).toBe('inventory-table-title');
    expect(element.querySelector('.selector-divider')).toBeNull();
  });

  it('keeps template/export and workbook import connected to the selected cava', async () => {
    await chooseCellar();
    const buttons = fixture.nativeElement.querySelectorAll('.toolbar-button');
    buttons[0].click();
    buttons[1].click();
    expect(commands.getInventoryTemplate).toHaveBeenCalledWith('cellar-1');
    expect(commands.getInventoryExport).toHaveBeenCalledWith('cellar-1');
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});
    buttons[2].click();
    expect(click).toHaveBeenCalledOnce();
    const workbook = new File(['workbook'], 'inventory.xlsx');
    Object.defineProperty(fileInput, 'files', { value: [workbook] });
    fileInput.dispatchEvent(new Event('change'));
    expect(commands.importInventory).toHaveBeenCalledWith('cellar-1', workbook);
    expect(loadItems).toHaveBeenCalledTimes(2);
  });

  it('preserves add, edit, and delete service payloads', async () => {
    await chooseCellar();
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(payload) } as MatDialogRef<AddWineInventoryItemDialogComponent>);
    fixture.nativeElement.querySelector('.toolbar-button--primary').click();
    expect(commands.createInventoryItem).toHaveBeenCalledWith('cellar-1', payload);
    expect(open).toHaveBeenCalledWith(AddWineInventoryItemDialogComponent, expect.objectContaining({ panelClass: 'inventory-management-dialog' }));
    fixture.nativeElement.querySelector('.item-action:not(.item-action--delete)').click();
    expect(commands.updateInventoryItem).toHaveBeenCalledWith('cellar-1', 'item-1', payload);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.nativeElement.querySelector('.item-action--delete').click();
    expect(commands.deleteInventoryItem).toHaveBeenCalledWith('cellar-1', 'item-1');
  });

  it('restores the cava inventory deep link', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [InventorySelectionPanelComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ spaceId: 'space-1', wineCellarId: 'cellar-1' })) } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: () => of([organization]), handleGetSpacesByOrganization: loadSpaces } },
        { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: loadCellars } },
        { provide: WineInventoryItemQueryServiceImpl, useValue: { getInventoryItemsByWineCellar: loadItems } },
        { provide: WineInventoryItemCommandServiceImpl, useValue: commands },
        { provide: InventoryIntelligenceCommandServiceImpl, useValue: { analyzeStock: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InventorySelectionPanelComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedWineCellar?.id.value).toBe('cellar-1');
    expect(fixture.componentInstance.selectedOrganization?.id.value).toBe('org-1');
    expect(fixture.nativeElement.querySelector('.wine-name').textContent).toBe('Malbec Reserva');
  });
});

describe('Inventory wine dialog', () => {
  let fixture: ComponentFixture<AddWineInventoryItemDialogComponent>;
  const close = vi.fn();

  beforeEach(async () => {
    close.mockReset();
    await TestBed.configureTestingModule({
      imports: [AddWineInventoryItemDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { title: 'Add wine to inventory', submitLabel: 'Add wine' } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AddWineInventoryItemDialogComponent);
    await fixture.whenStable();
  });

  it('preserves required and numeric minimum validation', () => {
    expect(fixture.nativeElement.querySelector('.dialog-button--primary').disabled).toBe(true);
    fixture.componentInstance.form.setValue({ ...payload, ageYears: -1, quantity: 0 });
    expect(fixture.componentInstance.form.controls.ageYears.hasError('min')).toBe(true);
    expect(fixture.componentInstance.form.controls.quantity.hasError('min')).toBe(true);
    fixture.componentInstance.submit();
    expect(close).not.toHaveBeenCalled();
  });

  it('submits trimmed fields and retains cancellation', async () => {
    fixture.componentInstance.form.setValue({ ...payload, wineName: ' Malbec Reserva ', wineType: ' Tinto ' });
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.dialog-button--primary').click();
    expect(close).toHaveBeenCalledWith(payload);
    close.mockClear();
    fixture.nativeElement.querySelector('.dialog-button:not(.dialog-button--primary)').click();
    expect(close).toHaveBeenCalledOnce();
    expect(close.mock.calls[0][0]).toBeUndefined();
  });
});
