import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { InventorySelectionPanelComponent } from './inventory-selection-panel/inventory-selection-panel.component';
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
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';
import { WorkspaceApiService } from '../../../shared/services/workspace-api.service';
import { ownerAccess } from '../../../shared/testing/workspace.fixtures';
import { StockMovementDialogComponent } from './stock-movement-dialog/stock-movement-dialog';
import { StockMovement } from '../../domain/model/stock-movement';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';

const organization: Organization = { id: createOrganizationId('org-1'), name: 'Estate', ownerUserId: createUserId('user-1'), createdAt: null, updatedAt: null };
const space: Space = { ...ownerAccess, id: createSpaceId('space-1'), name: 'Reserve', organizationId: organization.id, ownerUserId: organization.ownerUserId, createdAt: null, updatedAt: null };
const cellar: WineCellar = { id: createWineCellarId('cellar-1'), spaceId: space.id, name: 'Reserve Cellar', description: null, deviceId: null, createdAt: null, updatedAt: null };
const item: WineInventoryItem = { id: createWineInventoryItemId('item-1'), wineCellarId: cellar.id, name: 'Malbec Reserva', wineType: 'Tinto', ageYears: 3, quantity: 12, createdAt: null, updatedAt: null };

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
        provideRouter([]),
        { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [space], cellars: [cellar] }) } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: () => of([organization]), handleGetSpacesByOrganization: loadSpaces } },
        { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: loadCellars } },
        { provide: WineInventoryItemQueryServiceImpl, useValue: { getInventoryItemsByWineCellar: loadItems } },
        { provide: WineInventoryItemCommandServiceImpl, useValue: commands },
        { provide: InventoryIntelligenceCommandServiceImpl, useValue: { analyzeStockStream: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InventorySelectionPanelComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.restoreAllMocks());

  async function chooseCellar() {
    TestBed.inject(WorkspaceContextService).chooseCellar('cellar-1', false);
    await fixture.whenStable();
  }

  it('uses the global workspace and keeps inventory visible when reselecting its space', async () => {
    expect(fixture.nativeElement.querySelector('.selector-bar')).toBeNull();
    await chooseCellar();
    expect(loadSpaces).not.toHaveBeenCalled();
    expect(loadCellars).not.toHaveBeenCalled();
    expect(loadItems).toHaveBeenCalledWith('cellar-1');
    TestBed.inject(WorkspaceContextService).chooseSpace('space-1', false);
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedSpace?.id.value).toBe('space-1');
    expect(fixture.componentInstance.selectedWineCellar?.id.value).toBe('cellar-1');
    expect(fixture.nativeElement.querySelector('.inventory-table')).toBeTruthy();
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

  it('navigates to full-page creation and editing without opening a modal; retains confirmed deletion', async () => {
    await chooseCellar();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown>);
    fixture.nativeElement.querySelector('.toolbar-button--primary').click();
    expect(navigate).toHaveBeenCalledWith(['/inventory/new'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
    fixture.nativeElement.querySelector('.item-action:not(.item-action--delete)').click();
    expect(navigate).toHaveBeenCalledWith(['/inventory/edit', 'item-1'], { queryParams: { spaceId: 'space-1', wineCellarId: 'cellar-1' } });
    expect(open).not.toHaveBeenCalled();
    expect(commands.createInventoryItem).not.toHaveBeenCalled();
    expect(commands.updateInventoryItem).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.item-action--delete').click();
    expect(commands.deleteInventoryItem).toHaveBeenCalledWith('cellar-1', 'item-1');
    expect(open).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ panelClass: 'destructive-confirmation-dialog' }));
  });

  it('does not delete inventory when the shared confirmation is cancelled', async () => {
    await chooseCellar();
    vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown>);
    fixture.nativeElement.querySelector('.item-action--delete').click();
    expect(commands.deleteInventoryItem).not.toHaveBeenCalled();
  });

  it('shows the quota business message for Excel rejection and keeps the current inventory intact', async () => {
    await chooseCellar();
    const notify = vi.spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    commands.importInventory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403, error: { detail: { code: 'ITEM_LIMIT_REACHED', message: 'Libera SKUs o cambia de plan' } } })));
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['data'], 'inventory.xlsx')] });
    input.dispatchEvent(new Event('change'));
    expect(notify).toHaveBeenCalledWith('Libera SKUs o cambia de plan', 'Close', { duration: 4000 });
    expect(fixture.componentInstance.selectedWineCellarInventoryItems).toEqual([item]);
    expect(fixture.componentInstance.importingSelectedWineCellarInventory).toBe(false);
  });

  it('applies stock_after, keeps a zero-stock item and never sends an additional update/delete', async () => {
    await chooseCellar();
    const closed = new Subject<StockMovement>();
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => closed.asObservable() } as MatDialogRef<StockMovementDialogComponent>);
    fixture.nativeElement.querySelector('.movement-action').click();
    fixture.componentInstance.openMovements(item, 'exit');
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(StockMovementDialogComponent, expect.objectContaining({ data: { item, spaceId: 'space-1', mode: 'exit' } }));
    closed.next({ stockBefore: 12, stockAfter: 0 } as StockMovement);
    closed.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.quantity-cell').textContent).toBe('0');
    expect(fixture.nativeElement.querySelector('.wine-name').textContent).toBe(item.name);
    expect(fixture.nativeElement.querySelector('.movement-action').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.history-action')).toBeTruthy();
    expect(commands.updateInventoryItem).not.toHaveBeenCalled();
    expect(commands.deleteInventoryItem).not.toHaveBeenCalled();
  });

  it('exposes history but no write actions to a WAITER', async () => {
    await chooseCellar();
    TestBed.inject(WorkspaceScopeService).activate({ ...space, role: 'WAITER' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.movement-action')).toBeNull();
    expect(fixture.nativeElement.querySelector('.item-action--delete')).toBeNull();
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<StockMovementDialogComponent>);
    fixture.componentInstance.openMovements(item, 'exit');
    expect(open).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.history-action').click();
    expect(open).toHaveBeenCalledWith(StockMovementDialogComponent, expect.objectContaining({ data: { item, spaceId: 'space-1', mode: 'history' } }));
  });

  it('warns that deleting the item also deletes movement history', async () => {
    await chooseCellar();
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown>);
    fixture.componentInstance.deleteWineInventoryItem(item);
    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ description: expect.stringContaining('movement history') }) }));
  });

  it('restores the cava inventory deep link', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [InventorySelectionPanelComponent],
      providers: [
        provideRouter([{ path: 'inventory', component: InventorySelectionPanelComponent }]),
        { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [space], cellars: [cellar] }) } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: () => of([organization]), handleGetSpacesByOrganization: loadSpaces } },
        { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: loadCellars } },
        { provide: WineInventoryItemQueryServiceImpl, useValue: { getInventoryItemsByWineCellar: loadItems } },
        { provide: WineInventoryItemCommandServiceImpl, useValue: commands },
        { provide: InventoryIntelligenceCommandServiceImpl, useValue: { analyzeStockStream: vi.fn() } },
      ],
    }).compileComponents();
    await TestBed.inject(Router).navigateByUrl('/inventory?spaceId=space-1&wineCellarId=cellar-1');
    fixture = TestBed.createComponent(InventorySelectionPanelComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedWineCellar?.id.value).toBe('cellar-1');
    expect(fixture.componentInstance.selectedSpace?.id.value).toBe('space-1');
    expect(fixture.nativeElement.querySelector('.wine-name').textContent).toBe('Malbec Reserva');
  });
});
