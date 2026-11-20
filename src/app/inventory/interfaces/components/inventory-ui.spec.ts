import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
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
import { SpaceQuotaDialogComponent } from '../../../shared/components/space-quota-dialog/space-quota-dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { By } from '@angular/platform-browser';
import { InventoryExportDialogComponent } from './inventory-export-dialog/inventory-export-dialog';
import { InventoryImportDialogComponent } from './inventory-import-dialog/inventory-import-dialog';

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
    exportInventory: vi.fn(() => of(new HttpResponse<Blob>())),
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

  afterEach(() => { TestBed.inject(MatDialog).closeAll(); vi.restoreAllMocks(); });

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

  it('shows only Importar and Descargar and moves the template/upload into a scoped import dialog', async () => {
    await chooseCellar();
    fixture.nativeElement.querySelector('.inventory-options').click();
    await fixture.whenStable();
    expect(Array.from(document.querySelectorAll('.mat-mdc-menu-panel button')).map(button => button.querySelector('span.mat-mdc-menu-item-text')?.textContent?.trim())).toEqual(['Importar', 'Descargar']);
    expect(document.querySelector('.download-template')).toBeNull();
    (document.querySelector('.import-inventory') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger).menuOpen).toBe(false);
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    expect(ref.componentInstance).toBeInstanceOf(InventoryImportDialogComponent);
    expect(ref.componentInstance.data).toEqual({ spaceId: 'space-1', spaceName: 'Reserve', cellarId: 'cellar-1', cellarName: 'Reserve Cellar' });
    expect(document.querySelector('app-inventory-import-dialog .download-template')).toBeTruthy();
    const fileInput = document.querySelector('app-inventory-import-dialog input[type="file"]') as HTMLInputElement;
    const workbook = new File(['workbook'], 'inventory.xlsx');
    Object.defineProperty(fileInput, 'files', { value: [workbook] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(commands.importInventory).not.toHaveBeenCalled();
    (document.querySelector('.confirm-import') as HTMLButtonElement).click();
    expect(commands.importInventory).toHaveBeenCalledWith('cellar-1', workbook);
    expect(loadItems).toHaveBeenCalledTimes(2);
    expect(ref.componentInstance.result()?.created).toBe(1);
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
  });

  it('opens the export chooser from Options with the active space/cellar without immediately downloading', async () => {
    await chooseCellar();
    fixture.nativeElement.querySelector('.inventory-options').click();
    await fixture.whenStable();
    (document.querySelector('.download-inventory') as HTMLButtonElement).click();
    fixture.componentInstance.openExportDialog();
    await fixture.whenStable();
    const dialogs = TestBed.inject(MatDialog).openDialogs;
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].componentInstance).toBeInstanceOf(InventoryExportDialogComponent);
    expect(dialogs[0].componentInstance.data).toEqual({ spaceId: 'space-1', spaceName: 'Reserve', cellar: { id: 'cellar-1', name: 'Reserve Cellar' } });
    expect(document.querySelector('app-inventory-export-dialog')?.textContent).toContain('Excel (.xlsx)');
    expect(document.querySelector('app-inventory-export-dialog')?.textContent).toContain('PDF (.pdf)');
    expect(commands.exportInventory).not.toHaveBeenCalled();
  });

  it('shows exactly Refresh, Options and Add wine with no continuous quota summary or embedded AI button', async () => {
    await chooseCellar();
    const actions = fixture.nativeElement.querySelector('.inventory-table-actions') as HTMLElement;
    const buttons = Array.from(actions.querySelectorAll('button'));
    expect(buttons).toHaveLength(3);
    expect(buttons[0].classList.contains('inventory-refresh')).toBe(true);
    expect(buttons[1].classList.contains('inventory-options')).toBe(true);
    expect(buttons[2].textContent).toContain('Add wine');
    expect(fixture.nativeElement.querySelector('app-space-quota-summary, app-ai-stock-analysis')).toBeNull();
    expect(document.querySelector('.download-template')).toBeNull();
  });

  it('closes Options with Escape or outside click and restores focus to its trigger', async () => {
    await chooseCellar();
    const trigger = fixture.nativeElement.querySelector('.inventory-options') as HTMLButtonElement;
    const menu = fixture.debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger);
    trigger.click();
    await fixture.whenStable();
    (document.querySelector('.mat-mdc-menu-panel') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await fixture.whenStable();
    expect(menu.menuOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await fixture.whenStable();
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    await fixture.whenStable();
    expect(menu.menuOpen).toBe(false);
  });

  it('closes an open Options menu when the selected context is cleared', async () => {
    await chooseCellar();
    fixture.nativeElement.querySelector('.inventory-options').click();
    await fixture.whenStable();
    const menu = fixture.debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger);
    TestBed.inject(WorkspaceContextService).clearSelection();
    await fixture.whenStable();
    expect(menu.menuOpen).toBe(false);
    expect(fixture.nativeElement.querySelector('.inventory-table-actions')).toBeNull();
  });

  it('preserves Refresh loading state and blocks duplicate refreshes', async () => {
    await chooseCellar();
    const pending = new Subject<WineInventoryItem[]>();
    loadItems.mockReturnValueOnce(pending);
    const button = fixture.nativeElement.querySelector('.inventory-refresh') as HTMLButtonElement;
    button.click();
    fixture.componentInstance.refreshInventory();
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Refreshing');
    expect(loadItems).toHaveBeenCalledTimes(2);
    pending.next([item]);
    pending.complete();
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.wine-name').textContent).toBe(item.name);
  });

  it('blocks duplicate import dialogs and closes with Escape, restoring Options focus', async () => {
    await chooseCellar();
    fixture.nativeElement.querySelector('.inventory-options').click();
    await fixture.whenStable();
    (document.querySelector('.import-inventory') as HTMLButtonElement).click();
    fixture.componentInstance.openImportDialog();
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    const completed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (document.querySelector('mat-dialog-container') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await completed;
    await fixture.whenStable();
    expect(fixture.componentInstance.importDialogOpen).toBe(false);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.inventory-options'));
  });

  it('shows real space quotas only on demand, updates them reactively and keeps the main table unchanged', async () => {
    await chooseCellar();
    const workspace = TestBed.inject(WorkspaceContextService);
    const quotas = { cellars: { used: 1, limit: 3, remaining: 2 }, bottles: { used: 35, limit: 50, remaining: 15 }, skus: { used: 7, limit: null, remaining: null } };
    workspace.spaces.update(spaces => spaces.map(s => ({ ...s, quotas })));
    workspace.chooseSpace('space-1', false);
    await fixture.whenStable();
    expect(document.querySelector('app-space-quota-dialog')).toBeNull();
    fixture.nativeElement.querySelector('.quota-link').click();
    fixture.componentInstance.showQuotas();
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    expect(TestBed.inject(MatDialog).openDialogs[0].componentInstance).toBeInstanceOf(SpaceQuotaDialogComponent);
    const modal = document.querySelector('app-space-quota-dialog') as HTMLElement;
    expect(modal.textContent).toContain('Reserve');
    expect(modal.textContent).toContain('todo el espacio');
    expect(modal.textContent).toContain('1 / 3');
    expect(modal.textContent).toContain('15 disponibles');
    expect(modal.textContent).toContain('7 / Sin límite');
    workspace.spaces.update(spaces => spaces.map(s => ({ ...s, quotas: { ...quotas, bottles: { used: 50, limit: 50, remaining: 0 } } })));
    workspace.chooseSpace('space-1', false);
    await fixture.whenStable();
    expect(modal.textContent).toContain('0 disponibles');
    expect(fixture.nativeElement.querySelector('.wine-name').textContent).toBe(item.name);
    const close = vi.spyOn(TestBed.inject(MatDialog).openDialogs[0], 'close');
    workspace.clearSelection();
    await fixture.whenStable();
    expect(close).toHaveBeenCalled();
  });

  it('keeps the empty inventory hierarchy and reports unknown quotas without inventing limits', async () => {
    await chooseCellar();
    loadItems.mockReturnValueOnce(of([]));
    fixture.componentInstance.refreshInventory();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.empty-state').textContent).toContain('No inventory items');
    expect(fixture.nativeElement.querySelector('.inventory-table')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.inventory-table-actions button')).toHaveLength(3);
    fixture.nativeElement.querySelector('.quota-link').click();
    await fixture.whenStable();
    expect(document.querySelector('app-space-quota-dialog')?.textContent).toContain('no están disponibles');
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
    commands.importInventory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403, error: { detail: { code: 'ITEM_LIMIT_REACHED', message: 'Libera SKUs o cambia de plan' } } })));
    fixture.componentInstance.openImportDialog();
    await fixture.whenStable();
    const input = document.querySelector('app-inventory-import-dialog input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['data'], 'inventory.xlsx')] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    (document.querySelector('.confirm-import') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(document.querySelector('app-inventory-import-dialog .error')?.textContent).toContain('Libera SKUs o cambia de plan');
    expect(fixture.componentInstance.selectedWineCellarInventoryItems).toEqual([item]);
    expect((document.querySelector('.confirm-import') as HTMLButtonElement).disabled).toBe(false);
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
    expect(fixture.nativeElement.querySelector('.toolbar-button--primary')).toBeNull();
    fixture.nativeElement.querySelector('.inventory-options').click();
    await fixture.whenStable();
    expect((document.querySelector('.import-inventory') as HTMLButtonElement).disabled).toBe(true);
    fixture.componentInstance.openImportDialog();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    expect(document.querySelector('.download-template')).toBeNull();
    expect(document.querySelector('.download-inventory')).toBeTruthy();
    fixture.debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger).closeMenu();
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
