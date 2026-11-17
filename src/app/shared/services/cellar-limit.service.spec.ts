import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { CellarLimitService } from './cellar-limit.service';
import { WorkspaceContextService } from './workspace-context.service';
import { ownerAccess } from '../testing/workspace.fixtures';

describe('Cellar capacity offer', () => {
  const space = { ...ownerAccess, id: { value: 'original-space' }, name: 'Mi colección' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: WorkspaceContextService, useValue: { spaces: () => [space], selection: () => ({ space }) } },
    ] });
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('deduplicates proactive and backend offers and links to the exact space subscription', async () => {
    const service = TestBed.inject(CellarLimitService);
    service.open(space.id.value);
    service.open(space.id.value);
    const dialog = TestBed.inject(MatDialog);
    await dialog.openDialogs[0].componentRef!.changeDetectorRef.detectChanges();
    expect(dialog.openDialogs).toHaveLength(1);
    const modal = document.querySelector('app-cellar-limit-modal')!;
    expect(modal.textContent).toContain('Límite de cavas alcanzado');
    expect(modal.textContent).toContain('1 Cava Principal');
    const link = modal.querySelector('a')!;
    expect(link.textContent).toContain('Mejorar espacio a Pro');
    expect(link.getAttribute('href')).toBe('/subscription?spaceId=original-space');
    (modal.querySelector('button') as HTMLButtonElement).click();
    expect(dialog.openDialogs[0]?.getState()).not.toBe(0);
  });

  it('does not attach an offer to an unknown or inaccessible space', () => {
    TestBed.inject(CellarLimitService).open('unknown');
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });
});
