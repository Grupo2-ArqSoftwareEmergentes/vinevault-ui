import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { downloadInventoryFile, inventoryExportError, inventoryFilename } from './inventory-file-download';

describe('Inventory file download', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('uses the CORS-exposed filename, removes the link and revokes the object URL only after a delay', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:inventory-report');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    let filename = '';
    let attached = false;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; attached = document.body.contains(this); });
    const body = new Blob(['PDF report'], { type: 'application/pdf' });
    downloadInventoryFile(new HttpResponse({ body, headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="Cava principal.pdf"' }) }));
    expect(filename).toBe('Cava principal.pdf');
    expect(attached).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(createObjectURL).toHaveBeenCalledWith(body);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:inventory-report');
  });

  it('supports Unicode filenames, quoted names, safe fallbacks and malformed encoding', () => {
    expect(inventoryFilename("attachment; filename*=UTF-8''Colecci%C3%B3n.xlsx", 'inventario.xlsx')).toBe('Colección.xlsx');
    expect(inventoryFilename('attachment; filename="mi inventario.pdf"', 'inventario.pdf')).toBe('mi inventario.pdf');
    expect(inventoryFilename("attachment; filename=correcto.pdf; filename*=UTF-8''bad%escape", 'inventario.pdf')).toBe('correcto.pdf');
    expect(inventoryFilename(null, 'inventario.pdf')).toBe('inventario.pdf');
    expect(inventoryFilename('attachment; filename="../../informe.xlsx"', 'inventario.xlsx')).toBe('informe.xlsx');
  });

  it('does not create a download for absent bodies or error responses', () => {
    const createObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL });
    downloadInventoryFile(new HttpResponse<Blob>());
    downloadInventoryFile(new HttpResponse({ status: 500, body: new Blob(['error']) }));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  for (const [status, expected] of [[403, 'No tienes acceso'], [404, 'Revisa el espacio'], [413, 'Exporta por cava'], [422, 'Revisa los parámetros'], [500, 'generar el informe'], [0, 'conexión']] as const) {
    it(`decodes a JSON Blob for HTTP ${status} and provides an actionable message`, async () => {
      const blob = new Blob(['not read as a file'], { type: 'application/json' });
      Object.defineProperty(blob, 'text', { value: () => Promise.resolve(JSON.stringify({ detail: { message: 'Detalle del servidor' } })) });
      const message = await inventoryExportError(new HttpErrorResponse({ status, error: blob }));
      expect(message).toContain(expected);
      expect(message).toContain('Detalle del servidor');
    });
  }

  it('falls back safely for malformed Blob JSON and reads FastAPI validation details', async () => {
    const blob = new Blob(['invalid']);
    Object.defineProperty(blob, 'text', { value: () => Promise.resolve('not JSON') });
    expect(await inventoryExportError(new HttpErrorResponse({ status: 500, error: blob }))).toContain('generar el informe');
    expect(await inventoryExportError(new HttpErrorResponse({ status: 422, error: { detail: [{ msg: 'Invalid UUID' }] } }))).toContain('Invalid UUID');
  });
});
