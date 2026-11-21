import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { InventoryImportDialogComponent } from './inventory-import-dialog';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { WorkspaceContextService, WorkspaceSelection } from '../../../../shared/services/workspace-context.service';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { InventoryFileDownloadService } from '../../services/inventory-file-download';
import { WineInventoryImportResult } from '../../../domain/services/wine-inventory-item-command-service';

describe('Inventory import dialog', () => {
  let fixture: ComponentFixture<InventoryImportDialogComponent>;
  const selection = signal<WorkspaceSelection>({ space: null, cellar: null });
  const permission = signal(true);
  const closed = new Subject<void>();
  const close = vi.fn(() => closed.next());
  const download = vi.fn();
  const commands = {
    getInventoryTemplate: vi.fn(() => of(new HttpResponse({ body: new Blob(['template']), headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="modelo.xlsx"' }) }))),
    importInventory: vi.fn((_cellar: string, _file: File) => of<WineInventoryImportResult>({ sheetName: 'inventory', totalRows: 3, created: 2, updated: 1 })),
  };
  beforeEach(async () => {
    vi.clearAllMocks(); permission.set(true);
    selection.set({ space: { id: { value: 's1' }, name: 'Espacio', role: 'OWNER' }, cellar: { id: { value: 'c1' }, spaceId: { value: 's1' }, name: 'Principal' } });
    TestBed.configureTestingModule({ imports: [InventoryImportDialogComponent], providers: [
      { provide: MAT_DIALOG_DATA, useValue: { spaceId: 's1', spaceName: 'Espacio', cellarId: 'c1', cellarName: 'Principal' } },
      { provide: MatDialogRef, useValue: { close, beforeClosed: () => closed.asObservable() } },
      { provide: WorkspaceContextService, useValue: { selection } },
      { provide: WorkspaceAccessService, useValue: { canInventory: permission, hasFeature: () => true } },
      { provide: WineInventoryItemCommandServiceImpl, useValue: commands },
      { provide: InventoryFileDownloadService, useValue: { download } },
    ] });
    fixture = TestBed.createComponent(InventoryImportDialogComponent);
    await fixture.whenStable();
  });
  afterEach(() => vi.restoreAllMocks());

  async function select(name = 'modelo.xlsx', content = 'workbook') {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const file = new File([content], name);
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    return file;
  }

  it('offers the active cellar model and downloads it without starting an import', () => {
    expect(fixture.nativeElement.textContent).toContain('Cava: Principal');
    fixture.componentInstance.downloadTemplate();
    expect(commands.getInventoryTemplate).toHaveBeenCalledExactlyOnceWith('c1');
    expect(download).toHaveBeenCalledWith(expect.any(HttpResponse), 'plantilla-inventario.xlsx');
    expect(commands.importInventory).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('requires an explicit confirmation, emits success once and retains the summary for review', async () => {
    const imported = vi.fn(); fixture.componentInstance.imported.subscribe(imported);
    const file = await select();
    expect(commands.importInventory).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('.confirm-import') as HTMLButtonElement).click();
    fixture.componentInstance.import();
    await fixture.whenStable();
    expect(commands.importInventory).toHaveBeenCalledExactlyOnceWith('c1', file);
    expect(imported).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('3 vinos importados');
    expect(fixture.nativeElement.textContent).toContain('2 creados · 1 actualizados');
    expect(close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.confirm-import')).toBeNull();
  });

  for (const [name, content] of [['report.pdf', 'PDF'], ['modelo.xlsx', ''], ['report.csv', 'CSV']]) {
    it(`validates ${name} (${content.length} bytes) before sending`, async () => {
      await select(name, content);
      fixture.componentInstance.import();
      expect(commands.importInventory).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('.xlsx');
      expect(fixture.nativeElement.querySelector('.confirm-import').disabled).toBe(true);
    });
  }

  it('blocks duplicates while uploading and does not replace the selected file', async () => {
    const pending = new Subject<WineInventoryImportResult>();
    commands.importInventory.mockReturnValueOnce(pending);
    const original = await select();
    fixture.componentInstance.import(); fixture.componentInstance.import();
    await select('other.xlsx');
    expect(commands.importInventory).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.file()).toBe(original);
    expect(fixture.nativeElement.querySelector('.confirm-import').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Importando…');
  });

  it('keeps row/header errors visible, preserves the file and allows correction after validation rejection', async () => {
    commands.importInventory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 422, error: { detail: { message: 'Revisa los encabezados', errors: [{ missing_header: 'name' }, { row: 4, message: 'Cantidad inválida' }] } } })));
    await select(); fixture.componentInstance.import(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Revisa los encabezados');
    expect(fixture.nativeElement.textContent).toContain('Cantidad inválida');
    expect(fixture.componentInstance.file()?.name).toBe('modelo.xlsx');
    expect(close).not.toHaveBeenCalled();
    await select('corregido.xlsx'); fixture.componentInstance.import();
    expect(commands.importInventory).toHaveBeenCalledTimes(2);
  });

  it('never blindly retries a mutation after a network error', async () => {
    commands.importInventory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await select(); fixture.componentInstance.import(); fixture.componentInstance.import(); await fixture.whenStable();
    expect(commands.importInventory).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('puede haberse aplicado');
    expect(fixture.nativeElement.querySelector('.confirm-import').disabled).toBe(true);
  });

  for (const change of ['space', 'cellar', 'permission', 'close', 'destroy']) {
    it(`cancels stale imports on ${change} and never emits success`, async () => {
      const pending = new Subject<WineInventoryImportResult>(); commands.importInventory.mockReturnValueOnce(pending);
      const imported = vi.fn(); fixture.componentInstance.imported.subscribe(imported);
      await select(); fixture.componentInstance.import();
      if (change === 'close') closed.next();
      else if (change === 'destroy') fixture.destroy();
      else if (change === 'permission') permission.set(false);
      else selection.update(value => change === 'space' ? { ...value, space: null } : { ...value, cellar: null });
      if (change !== 'destroy') await fixture.whenStable();
      pending.next({ sheetName: 'inventory', totalRows: 1, created: 1, updated: 0 });
      expect(imported).not.toHaveBeenCalled();
      expect(pending.observed).toBe(false);
    });
  }

  it('shows a template failure locally without closing or uploading anything', async () => {
    commands.getInventoryTemplate.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentInstance.downloadTemplate(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No se pudo descargar la plantilla');
    expect(close).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(fixture.componentInstance.downloading()).toBe(false);
  });
});
