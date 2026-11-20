import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { CellarLimitService } from './cellar-limit.service';
import { WorkspaceContextService } from './workspace-context.service';
import { ownerAccess, sampleCatalogResource } from '../testing/workspace.fixtures';
import { API_CONFIG } from '../../api.config';

const base = API_CONFIG.baseUrl;

describe('Cellar capacity offer', () => {
  const space = { ...ownerAccess, id: { value: 'original-space' }, name: 'Mi colección' };
  const sommelierSpace = { ...ownerAccess, id: { value: 'shared-space' }, name: 'Cava compartida', role: 'SOMMELIER' as const };
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      provideHttpClient(), provideHttpClientTesting(),
      { provide: WorkspaceContextService, useValue: { spaces: () => [space, sommelierSpace], selection: () => ({ space }) } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.inject(MatDialog).closeAll();
  });

  it('deduplicates proactive and backend offers, loads catalog limits and links OWNER to the space subscription', async () => {
    const service = TestBed.inject(CellarLimitService);
    service.open(space.id.value);
    service.open(space.id.value);
    const dialog = TestBed.inject(MatDialog);
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush(sampleCatalogResource);
    await dialog.openDialogs[0].componentRef!.changeDetectorRef.detectChanges();
    expect(dialog.openDialogs).toHaveLength(1);
    const modal = document.querySelector('app-cellar-limit-modal')!;
    expect(modal.textContent).toContain('Límite de cavas alcanzado');
    expect(modal.textContent).toContain('1 cava base');
    expect(modal.textContent).toContain('3 cavas base');
    expect(modal.textContent).toContain('S/ 29.99');
    const link = modal.querySelector('a')!;
    expect(link.textContent).toContain('Mejorar espacio a Pro');
    expect(link.getAttribute('href')).toBe('/subscription?spaceId=original-space');
    (modal.querySelector('button') as HTMLButtonElement).click();
    expect(dialog.openDialogs[0]?.getState()).not.toBe(0);
  });

  it('hides the upgrade CTA for non-OWNER roles and shows ITEM_LIMIT_REACHED details', async () => {
    const service = TestBed.inject(CellarLimitService);
    service.open(sommelierSpace.id.value, { reason: 'items', current: 51, limit: 50, message: 'Límite de botellas alcanzado.' });
    const dialog = TestBed.inject(MatDialog);
    http.expectOne(`${base}/api/v1/subscriptions/catalog`).flush(sampleCatalogResource);
    await dialog.openDialogs[0].componentRef!.changeDetectorRef.detectChanges();
    const modal = document.querySelector('app-cellar-limit-modal')!;
    expect(modal.textContent).toContain('Límite de inventario alcanzado');
    expect(modal.textContent).toContain('51 / 50');
    expect(modal.textContent).toContain('Solo el propietario del espacio puede cambiar el plan');
    expect(modal.querySelector('a')).toBeNull();
  });

  it('does not attach an offer to an unknown or inaccessible space', () => {
    expect(TestBed.inject(CellarLimitService).open('unknown')).toBe(false);
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });
});
