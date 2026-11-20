import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { extractApiErrorMessage } from '../../../device/interfaces/rest/transform/extract-api-error-message.transform';

export function inventoryFilename(disposition: string | null, fallback: string): string {
  const encoded = disposition?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename\s*=\s*"([^"]+)"/i)?.[1] ?? disposition?.match(/filename\s*=\s*([^;]+)/i)?.[1];
  let name = plain?.trim();
  if (encoded) { try { name = decodeURIComponent(encoded.trim()); } catch { /* Keep the ordinary filename if encoding is malformed. */ } }
  return name?.split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001f]/g, '').trim() || fallback;
}

export function downloadInventoryFile(response: HttpResponse<Blob>, fallback = 'inventario'): void {
  if (!response.ok || !response.body) return;
  const url = URL.createObjectURL(response.body);
  const link = document.createElement('a');
  link.href = url;
  link.download = inventoryFilename(response.headers.get('Content-Disposition'), fallback);
  link.style.display = 'none';
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    // Do not revoke before the browser has consumed the downloaded response.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Injectable boundary for the browser download side effect. */
@Injectable({ providedIn: 'root' })
export class InventoryFileDownloadService {
  download(response: HttpResponse<Blob>, fallback: string): void { downloadInventoryFile(response, fallback); }
}

export async function inventoryExportError(error: unknown): Promise<string> {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  const fallbacks: Record<number, string> = {
    403: 'No tienes acceso para exportar este espacio o cava.',
    404: 'Revisa el espacio y la cava seleccionados; no se encontró el ámbito solicitado.',
    413: 'El informe supera los 10 000 registros. Exporta por cava para reducir su tamaño.',
    422: 'Revisa los parámetros de exportación: espacio, cava y formato.',
    500: 'No se pudo generar el informe. Puedes reintentarlo.',
  };
  let payload = error instanceof HttpErrorResponse ? error.error : null;
  if (payload instanceof Blob) {
    try { payload = JSON.parse(await payload.text()); } catch { payload = null; }
  }
  const fallback = fallbacks[status] ?? 'No se pudo descargar el inventario. Comprueba la conexión e inténtalo de nuevo.';
  const detail = extractApiErrorMessage({ error: payload }, '');
  return detail ? `${fallback} ${detail}` : fallback;
}
