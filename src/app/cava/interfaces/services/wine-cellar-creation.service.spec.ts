import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WineCellarCreationService } from './wine-cellar-creation.service';
import { WineCellarDialogComponent, WineCellarDialogResult } from '../components/wine-cellar-dialog/wine-cellar-dialog.component';
import { WineCellarCommandServiceImpl } from '../../application/internal/commandservices/wine-cellar-command-service.impl';
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';
import { WineCellar } from '../../domain/services/wine-cellar-query-service';

const created: WineCellar = {
  id: { value: 'cellar-1' }, spaceId: { value: 'space-1' }, name: 'Reserva', description: 'Tintos',
  deviceId: null, createdAt: null, updatedAt: null,
};
const linked = { ...created, deviceId: { value: 'device-1' } };

describe('Shared full cellar creation flow', () => {
  let result: Subject<WineCellarDialogResult | undefined>;
  let activeSpace: string;
  const open = vi.fn();
  const create = vi.fn();
  const link = vi.fn();
  const upsert = vi.fn();
  const notify = vi.fn();

  beforeEach(() => {
    activeSpace = 'space-1';
    result = new Subject();
    open.mockReset().mockReturnValue({ afterClosed: () => result });
    create.mockReset().mockReturnValue(of(created));
    link.mockReset().mockReturnValue(of(linked));
    upsert.mockReset();
    notify.mockReset();
    TestBed.configureTestingModule({ providers: [
      WineCellarCreationService,
      { provide: MatDialog, useValue: { open } },
      { provide: MatSnackBar, useValue: { open: notify } },
      { provide: WineCellarCommandServiceImpl, useValue: { createWineCellar: create, linkDevice: link } },
      { provide: WorkspaceContextService, useValue: { spaces: () => [{ id: { value: 'space-1' }, role: 'OWNER' }], selection: () => ({ space: { id: { value: activeSpace } } }), upsertCellar: upsert } },
    ] });
  });

  it('opens the full styled modal and creates and links the selected sensor exactly once', () => {
    const next = vi.fn();
    TestBed.inject(WineCellarCreationService).open('space-1').subscribe(next);
    expect(open).toHaveBeenCalledWith(WineCellarDialogComponent, expect.objectContaining({
      panelClass: 'cava-management-dialog', data: { title: 'Crear cava', submitLabel: 'Crear', spaceId: 'space-1' },
    }));
    expect(create).not.toHaveBeenCalled();
    result.next({ name: 'Reserva', description: 'Tintos', deviceId: 'device-1' });
    expect(create).toHaveBeenCalledExactlyOnceWith('space-1', { name: 'Reserva', description: 'Tintos' });
    expect(link).toHaveBeenCalledExactlyOnceWith('cellar-1', 'device-1');
    expect(upsert).toHaveBeenCalledWith(linked, true, true);
    expect(next).toHaveBeenCalledWith(linked);
  });

  it('creates without a device when none is chosen', () => {
    TestBed.inject(WineCellarCreationService).open('space-1').subscribe();
    result.next({ name: 'Reserva', description: null, deviceId: null });
    expect(create).toHaveBeenCalledWith('space-1', { name: 'Reserva', description: null });
    expect(link).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(created, true, true);
  });

  it('does nothing on cancellation', () => {
    TestBed.inject(WineCellarCreationService).open('space-1').subscribe();
    result.next(undefined);
    expect(create).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('keeps the opening space ID if the active workspace changes while the modal is open', () => {
    TestBed.inject(WineCellarCreationService).open('space-1').subscribe();
    activeSpace = 'space-2';
    result.next({ name: 'Reserva', description: 'Tintos', deviceId: null });
    expect(create).toHaveBeenCalledWith('space-1', { name: 'Reserva', description: 'Tintos' });
    expect(upsert).toHaveBeenCalledWith(created, false, true);
  });

  it('keeps the created cellar without repeating the POST if device linking fails', () => {
    link.mockReturnValue(throwError(() => new Error('Offline')));
    TestBed.inject(WineCellarCreationService).open('space-1').subscribe();
    result.next({ name: 'Reserva', description: 'Tintos', deviceId: 'device-1' });
    expect(create).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(created, true, true);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('no se pudo vincular'), 'Close', expect.anything());
  });

  it('reports creation failure without adding a cellar or linking a sensor', () => {
    create.mockReturnValue(throwError(() => new Error('Offline')));
    TestBed.inject(WineCellarCreationService).open('space-1').subscribe();
    result.next({ name: 'Reserva', description: 'Tintos', deviceId: 'device-1' });
    expect(upsert).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
  });
});
