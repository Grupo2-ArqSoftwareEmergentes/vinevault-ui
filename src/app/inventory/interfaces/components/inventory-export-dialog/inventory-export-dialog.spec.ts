import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { InventoryExportDialogComponent, InventoryExportDialogData } from './inventory-export-dialog';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { InventoryExportFormat } from '../../../domain/services/wine-inventory-item-command-service';
import { WorkspaceContextService, WorkspaceSelection } from '../../../../shared/services/workspace-context.service';
import { InventoryFileDownloadService } from '../../services/inventory-file-download';

describe('Inventory report export dialog', () => {
  let fixture: ComponentFixture<InventoryExportDialogComponent>;
  let selection: ReturnType<typeof signal<WorkspaceSelection>>;
  let beforeClosed: Subject<void>;
  let data: InventoryExportDialogData;
  const exportInventory = vi.fn<(spaceId: string, format: InventoryExportFormat, cellarId?: string) => Observable<HttpResponse<Blob>>>();
  const close = vi.fn();
  const download = vi.fn();
  const file = () => new HttpResponse({ body: new Blob(['report'], { type: 'application/pdf' }) });

  beforeEach(() => {
    data = { spaceId: 'space-1', spaceName: 'Mi espacio', cellar: { id: 'cellar-1', name: 'Principal' } };
    selection = signal<WorkspaceSelection>({ space: { id: { value: 'space-1' }, name: 'Mi espacio', role: 'OWNER' }, cellar: { id: { value: 'cellar-1' }, name: 'Principal', spaceId: { value: 'space-1' } } });
    beforeClosed = new Subject();
    close.mockReset().mockImplementation(() => beforeClosed.next());
    exportInventory.mockReset().mockReturnValue(of(file()));
    download.mockReset();
    TestBed.configureTestingModule({ imports: [InventoryExportDialogComponent], providers: [
      { provide: MAT_DIALOG_DATA, useFactory: () => data },
      { provide: MatDialogRef, useValue: { close, beforeClosed: () => beforeClosed.asObservable() } },
      { provide: WorkspaceContextService, useValue: { selection } },
      { provide: WineInventoryItemCommandServiceImpl, useValue: { exportInventory } },
      { provide: InventoryFileDownloadService, useValue: { download } },
    ] });
  });
  afterEach(() => vi.restoreAllMocks());

  async function render(wholeSpace = false) {
    if (wholeSpace) { data = { spaceId: 'space-1', spaceName: 'Mi espacio' }; selection.update(value => ({ ...value, cellar: null })); }
    fixture = TestBed.createComponent(InventoryExportDialogComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('defaults to the selected cellar, displays the scope and explains the reimportable worksheet', async () => {
    const component = await render();
    expect(component.scopeLabel).toBe('Cava: Principal');
    expect(fixture.nativeElement.textContent).toContain('Inventario');
    expect(fixture.nativeElement.textContent).toContain('inventory');
    expect(fixture.nativeElement.textContent).toContain('reimportable');
    expect(exportInventory).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.export-button').click();
    expect(exportInventory).toHaveBeenCalledExactlyOnceWith('space-1', 'xlsx', 'cellar-1');
    expect(download).toHaveBeenCalledWith(expect.any(HttpResponse), 'inventario.xlsx');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('exports PDF for the whole space even when a cellar is active, omitting its ID', async () => {
    const component = await render();
    fixture.nativeElement.querySelector('input[value="space"]').click();
    fixture.nativeElement.querySelector('input[value="pdf"]').click();
    await fixture.whenStable();
    expect(component.scopeLabel).toBe('Espacio completo');
    expect(fixture.nativeElement.textContent).toContain('PDF es un informe de consulta y no se puede importar');
    component.export();
    expect(exportInventory).toHaveBeenCalledExactlyOnceWith('space-1', 'pdf', undefined);
    expect(download).toHaveBeenCalledWith(expect.any(HttpResponse), 'inventario.pdf');
  });

  it('defaults to whole-space export without a cellar and warns that its Excel cannot be imported into one cava', async () => {
    const component = await render(true);
    expect(component.form.controls.scope.value).toBe('space');
    expect(fixture.nativeElement.textContent).toContain('no se puede importar en una única cava');
    component.export();
    expect(exportInventory).toHaveBeenCalledExactlyOnceWith('space-1', 'xlsx', undefined);
  });

  it('disables duplicate exports and scope changes while the file is generated', async () => {
    const pending = new Subject<HttpResponse<Blob>>();
    exportInventory.mockReturnValue(pending);
    const component = await render();
    component.export();
    component.export();
    await fixture.whenStable();
    expect(exportInventory).toHaveBeenCalledOnce();
    expect(component.exporting()).toBe(true);
    expect(fixture.nativeElement.querySelector('.export-button').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.export-button').textContent).toContain('Descargando');
    pending.next(file());
    pending.complete();
    expect(component.exporting()).toBe(false);
    component.export();
    expect(exportInventory).toHaveBeenCalledOnce();
  });

  for (const status of [403, 404, 413, 422, 500]) {
    it(`reads the JSON Blob for ${status}, keeps the dialog open and permits deliberate retry without downloading the error`, async () => {
      const blob = new Blob([], { type: 'application/json' });
      Object.defineProperty(blob, 'text', { value: () => Promise.resolve(JSON.stringify({ detail: 'Detalle de Core' })) });
      exportInventory.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status, error: blob })));
      const component = await render();
      component.export();
      await fixture.whenStable();
      expect(component.error()).toContain('Detalle de Core');
      if (status === 413) expect(component.error()).toContain('Exporta por cava');
      expect(component.exporting()).toBe(false);
      expect(download).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
      expect(component.form.getRawValue()).toEqual({ scope: 'cellar', format: 'xlsx' });
      component.export();
      expect(exportInventory).toHaveBeenCalledTimes(2);
      expect(download).toHaveBeenCalledOnce();
    });
  }

  for (const change of ['space', 'cellar', 'close', 'destroy'] as const) {
    it(`cancels a pending download on ${change}, never downloading a stale response`, async () => {
      const pending = new Subject<HttpResponse<Blob>>();
      exportInventory.mockReturnValue(pending);
      const component = await render();
      component.export();
      if (change === 'close') beforeClosed.next();
      else if (change === 'destroy') fixture.destroy();
      else {
        selection.update(value => change === 'space' ? { ...value, space: { ...value.space!, id: { value: 'space-2' } } } : { ...value, cellar: null });
        await fixture.whenStable();
        expect(close).toHaveBeenCalled();
      }
      pending.next(file());
      expect(component.exporting()).toBe(false);
      expect(download).not.toHaveBeenCalled();
    });
  }

  it('leaves 401 to the session flow and never downloads that response', async () => {
    exportInventory.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const component = await render();
    component.export();
    await fixture.whenStable();
    expect(component.error()).toBe('');
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects an empty file or a successful JSON payload instead of downloading it as a report', async () => {
    const component = await render();
    exportInventory.mockReturnValueOnce(of(new HttpResponse<Blob>()));
    component.export();
    expect(component.error()).toContain('archivo de inventario válido');
    exportInventory.mockReturnValueOnce(of(new HttpResponse({ body: new Blob(['{"detail":"error"}'], { type: 'application/json' }) })));
    component.export();
    expect(download).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
