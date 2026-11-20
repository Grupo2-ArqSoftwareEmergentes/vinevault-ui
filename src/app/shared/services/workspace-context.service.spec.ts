import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { Subject, filter, firstValueFrom, of, take, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { WineCellarDialogComponent } from '../../cava/interfaces/components/wine-cellar-dialog/wine-cellar-dialog.component';
import { ownerAccess } from '../testing/workspace.fixtures';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceScopeService } from './workspace-scope.service';
import { WORKSPACE_SELECTION_STORAGE_KEY, WorkspaceContextService } from './workspace-context.service';
import { StorageService } from '../../core/services/storage/storage';
import { WorkspaceApiService } from './workspace-api.service';
import { WorkspaceDirectory } from '../models/workspace-context';
import { WorkspaceSwitcherComponent } from '../components/workspace-switcher/workspace-switcher';
import { DEVICE_QUERY_SERVICE, Organization, Space } from '../../device/domain/services/device-query-service';
import { WineCellarQueryServiceImpl } from '../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineCellarCommandServiceImpl } from '../../cava/application/internal/commandservices/wine-cellar-command-service.impl';
import { WineCellar } from '../../cava/domain/services/wine-cellar-query-service';
import { AuthStateService } from '../../iam/presentation/state/auth-state/auth-state';
import { createOrganizationId } from '../../device/domain/model/valueobjects/organization-id.value-object';
import { createSpaceId } from '../../device/domain/model/valueobjects/space-id.value-object';
import { createUserId } from '../../device/domain/model/valueobjects/user-id.value-object';
import { createWineCellarId } from '../../cava/domain/model/valueobjects/wine-cellar-id.value-object';

@Component({ standalone: true, template: '' })
class WorkspaceTestPage {}

const organization: Organization = { id: createOrganizationId('org-1'), name: 'Estate', ownerUserId: createUserId('user-1'), createdAt: null, updatedAt: null };
const first: Space = { ...ownerAccess, id: createSpaceId('space-1'), name: 'North', organizationId: organization.id, ownerUserId: organization.ownerUserId, createdAt: null, updatedAt: null };
const second: Space = { ...first, id: createSpaceId('space-2'), name: 'South' };
const cellar: WineCellar = { id: createWineCellarId('cellar-1'), spaceId: first.id, name: 'Reserve', description: null, deviceId: { value: 'device-1' }, createdAt: null, updatedAt: null };
const otherCellar: WineCellar = { ...cellar, id: createWineCellarId('cellar-2'), spaceId: second.id, name: 'Collection' };
const createdSpace: Space = { ...first, id: createSpaceId('space-3'), name: 'New space' };
const defaultCellar = { id: createWineCellarId('default-cellar'), spaceId: createdSpace.id, name: 'Default cellar' };
const createdCellar: WineCellar = { ...cellar, id: createWineCellarId('cellar-3'), name: 'New cellar' };

describe('Global workspace directory and selector', () => {
  let context: WorkspaceContextService;
  let router: Router;
  let directory: WorkspaceDirectory;
  const loadContext = vi.fn(() => of<WorkspaceDirectory>(directory));
  const loadCellars = vi.fn((spaceId: string) => of(spaceId === 'space-1' ? [cellar] : [otherCellar]));
  const createSpace = vi.fn(() => of({ space: createdSpace, cellar: defaultCellar }));
  const createCellar = vi.fn(() => of(createdCellar));

  beforeEach(async () => {
    localStorage.removeItem(WORKSPACE_SELECTION_STORAGE_KEY);
    directory = {
      spaces: [first, second].map(({ id, name }) => ({ id, name, ...ownerAccess })),
      cellars: [cellar, otherCellar].map(({ id, name, spaceId }) => ({ id, name, spaceId })),
    };
    loadContext.mockReset().mockImplementation(() => of(directory));
    loadCellars.mockReset().mockImplementation((spaceId: string) => of(spaceId === 'space-1' ? [cellar] : [otherCellar]));
    createSpace.mockReset().mockImplementation(() => {
      directory = { ...directory, spaces: [...directory.spaces, createdSpace], cellars: [...directory.cellars, defaultCellar] };
      return of({ space: createdSpace, cellar: defaultCellar });
    });
    createCellar.mockReset().mockImplementation(() => {
      directory = { ...directory, cellars: [...directory.cellars, createdCellar] };
      return of(createdCellar);
    });
    await TestBed.configureTestingModule({
      imports: [WorkspaceSwitcherComponent],
      providers: [
        provideRouter(['', 'devices', 'alerts', 'cavas', 'inventory', 'spaces', 'subscription'].map((path) => ({ path, component: WorkspaceTestPage }))),
        { provide: WorkspaceApiService, useValue: { getContext: loadContext, createSpace } },
        { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: loadCellars } },
        { provide: WineCellarCommandServiceImpl, useValue: { createWineCellar: createCellar } },
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetDevicesBySpace: () => of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 }) } },
      ],
    }).compileComponents();
    context = TestBed.inject(WorkspaceContextService);
    router = TestBed.inject(Router);
  });

  afterEach(() => { localStorage.removeItem(WORKSPACE_SELECTION_STORAGE_KEY); vi.restoreAllMocks(); });

  it('shares one directory load instead of reloading for every view', () => {
    context.ensureLoaded();
    context.ensureLoaded();
    expect(loadContext).toHaveBeenCalledOnce();
    expect(loadCellars).not.toHaveBeenCalled();
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
  });

  it('changes purpose, subscription, role and cellar scope from membership metadata only', () => {
    directory = { ...directory, spaces: [directory.spaces[0], { ...directory.spaces[1], spaceType: 'BUSINESS', subscriptionPlan: 'PRO', subscriptionStatus: 'EXPIRED', role: 'WAITER' }] };
    context.ensureLoaded();
    context.chooseSpace('space-1', false);
    const access = TestBed.inject(WorkspaceAccessService);
    const signal = TestBed.inject(WorkspaceScopeService).signal;
    expect(access.canConfigure()).toBe(true);
    context.chooseSpace('space-2', false);
    expect(signal.aborted).toBe(true);
    expect(access.purpose()).toBe('BUSINESS');
    expect(access.plan()).toBe('PRO');
    expect(access.status()).toBe('EXPIRED');
    expect(access.role()).toBe('WAITER');
    expect(access.canConfigure()).toBe(false);
    expect(context.selection().cellar?.id.value).toBe('cellar-2');
  });

  it('switches a cellar with both IDs in the URL and clears stale device deep links', async () => {
    await router.navigateByUrl('/devices?deviceId=device-1&spaceId=space-1');
    context.ensureLoaded();
    const completed = firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationEnd), take(1)));
    context.chooseCellar('cellar-2');
    await completed;
    const params = router.parseUrl(router.url).queryParams;
    expect(params).toEqual({ spaceId: 'space-2', wineCellarId: 'cellar-2' });
    expect(context.selection().cellar?.id.value).toBe('cellar-2');
  });

  it('keeps the workspace across routes and honors explicit inventory deep links', async () => {
    context.ensureLoaded();
    context.chooseCellar('cellar-2', false);
    await router.navigateByUrl('/alerts');
    expect(context.selection().space?.id.value).toBe('space-2');
    expect(context.selection().cellar?.id.value).toBe('cellar-2');
    await router.navigateByUrl('/inventory?spaceId=space-1&wineCellarId=cellar-1');
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    await router.navigateByUrl('/devices?spaceId=space-1');
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    await router.navigateByUrl('/cavas?spaceId=space-2');
    expect(context.selection().space?.id.value).toBe('space-2');
    expect(context.selection().cellar?.id.value).toBe('cellar-2');
  });

  it('publishes and persists the initial space and associated cellar before signaling readiness', async () => {
    const response = new Subject<WorkspaceDirectory>();
    loadContext.mockReturnValueOnce(response);
    const changes = vi.fn();
    const subscription = context.selectionChanges.subscribe(changes);
    const ready = firstValueFrom(context.whenReady());
    expect(context.selection().space).toBeNull();
    // The first directory cellar need not belong to the first space.
    response.next({ ...directory, cellars: [...directory.cellars].reverse() });
    expect(await ready).toBe(true);
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    expect(TestBed.inject(WorkspaceScopeService).space()?.id.value).toBe('space-1');
    expect(changes).toHaveBeenLastCalledWith(context.selection());
    expect(TestBed.inject(StorageService).get(WORKSPACE_SELECTION_STORAGE_KEY)).toEqual({ spaceId: 'space-1', cellarId: 'cellar-1' });
    expect(createSpace).not.toHaveBeenCalled();
    expect(createCellar).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('restores the previous space and cellar on initial load without a URL selection', () => {
    TestBed.inject(StorageService).set(WORKSPACE_SELECTION_STORAGE_KEY, { spaceId: 'space-2', cellarId: 'cellar-2' });
    context.ensureLoaded();
    expect(context.selection().space?.id.value).toBe('space-2');
    expect(context.selection().cellar?.id.value).toBe('cellar-2');
  });

  for (const stored of [null, { spaceId: 'deleted', cellarId: 'cellar-2' }, { invalid: true }]) {
    it(`falls back immediately to the first space for invalid storage ${JSON.stringify(stored)}`, () => {
      TestBed.inject(StorageService).set(WORKSPACE_SELECTION_STORAGE_KEY, stored);
      context.ensureLoaded();
      expect(context.selection().space?.id.value).toBe('space-1');
      expect(context.selection().cellar?.id.value).toBe('cellar-1');
    });
  }

  it('replaces a missing or mismatched persisted cellar with one belonging to the restored space', () => {
    TestBed.inject(StorageService).set(WORKSPACE_SELECTION_STORAGE_KEY, { spaceId: 'space-2', cellarId: 'cellar-1' });
    context.ensureLoaded();
    expect(context.selection().space?.id.value).toBe('space-2');
    expect(context.selection().cellar?.id.value).toBe('cellar-2');
  });

  it('prioritizes an explicit space URL over local storage and selects its first cellar', async () => {
    TestBed.inject(StorageService).set(WORKSPACE_SELECTION_STORAGE_KEY, { spaceId: 'space-2', cellarId: 'cellar-2' });
    await router.navigateByUrl('/inventory?spaceId=space-1');
    context.ensureLoaded();
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
  });

  it('retains the current selection on refresh and falls back if that space was removed', () => {
    context.ensureLoaded();
    context.chooseCellar('cellar-2', false);
    context.refresh();
    expect(context.selection().space?.id.value).toBe('space-2');
    directory = { spaces: [directory.spaces[0]], cellars: [directory.cellars[0]] };
    context.refresh();
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
  });

  it('keeps a space without cellars selected, without using another space cellar', () => {
    directory = { ...directory, cellars: [directory.cellars[1]] };
    context.ensureLoaded();
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar).toBeNull();
  });

  it('keeps a truly empty account empty and removes stale persisted selection', () => {
    TestBed.inject(StorageService).set(WORKSPACE_SELECTION_STORAGE_KEY, { spaceId: 'space-2' });
    directory = { spaces: [], cellars: [] };
    context.ensureLoaded();
    expect(context.selection()).toEqual({ space: null, cellar: null });
    expect(localStorage.getItem(WORKSPACE_SELECTION_STORAGE_KEY)).toBeNull();
  });

  it('loads normally even when browser storage is unavailable', () => {
    const storage = TestBed.inject(StorageService);
    vi.spyOn(storage, 'get').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(storage, 'set').mockImplementation(() => { throw new Error('Blocked'); });
    context.ensureLoaded();
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    expect(context.loaded()).toBe(true);
  });

  it('does not display another cellar for invalid or mismatched deep links', async () => {
    context.ensureLoaded();
    await router.navigateByUrl('/inventory?wineCellarId=missing');
    expect(context.selection().cellar).toBeNull();
    expect(context.selection().space).toBeNull();
    await router.navigateByUrl('/inventory?spaceId=space-1&wineCellarId=cellar-2');
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar).toBeNull();
  });

  it('clears selection and cached directory on account changes and logout', () => {
    context.ensureLoaded();
    context.chooseCellar('cellar-1', false);
    const auth = TestBed.inject(AuthStateService);
    auth.setAuthenticated({ username: 'different-user', email: 'different@example.com' });
    expect(context.spaces().length).toBe(0);
    expect(context.selection().space).toBeNull();
    expect(context.loaded()).toBe(false);
    expect(localStorage.getItem(WORKSPACE_SELECTION_STORAGE_KEY)).toBeNull();
    context.ensureLoaded();
    auth.logout();
    expect(context.cellars().length).toBe(0);
    expect(context.selection().cellar).toBeNull();
  });

  it('offers retry after an initial API failure', () => {
    loadContext.mockReturnValueOnce(throwError(() => new Error('Offline')));
    context.ensureLoaded();
    expect(context.error()).toContain('Unable to load');
    expect(context.loading()).toBe(false);
    context.ensureLoaded();
    expect(context.loaded()).toBe(true);
    expect(context.error()).toBe('');
  });

  it('creates a first space without querying or creating an organization', () => {
    directory = { spaces: [], cellars: [] };
    context.ensureLoaded();
    context.createSpace('New space').subscribe();
    expect(createSpace).toHaveBeenCalledWith('New space', 'COLLECTOR');
    expect(loadContext).toHaveBeenCalledTimes(2);
    expect(context.selection().space?.id.value).toBe('space-3');
    expect(context.selection().cellar).toEqual(defaultCellar);
    expect(createCellar).not.toHaveBeenCalled();
  });

  async function openSelector(kind: 'space' | 'cellar' = 'space'): Promise<ComponentFixture<WorkspaceSwitcherComponent>> {
    const fixture = TestBed.createComponent(WorkspaceSwitcherComponent);
    await fixture.whenStable();
    fixture.nativeElement.querySelector(`.${kind}-trigger`).click();
    await fixture.whenStable();
    return fixture;
  }

  it('selects a cellar in one click and closes the accessible overlay', async () => {
    context.ensureLoaded();
    context.chooseSpace('space-1', false);
    const fixture = await openSelector('cellar');
    const option = document.querySelector<HTMLButtonElement>('.cellar-option')!;
    expect(option.textContent).toContain('Reserve');
    option.click();
    await fixture.whenStable();
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
    expect(fixture.nativeElement.querySelector('.cellar-trigger').getAttribute('aria-expanded')).toBe('false');
  });

  it('lists only spaces and Add Space, without matching cellar names', async () => {
    const fixture = await openSelector();
    expect(document.querySelectorAll('.space-option').length).toBe(2);
    expect(document.querySelector('.cellar-option')).toBeNull();
    expect(document.querySelector('.create-actions')?.textContent).toContain('+ Add Space');
    expect(document.querySelector('.create-actions')?.textContent).not.toContain('Add Cellar');
    const search = document.querySelector<HTMLInputElement>('.search-input')!;
    search.value = 'Collection';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelectorAll('.space-option').length).toBe(0);
    search.value = 'sou';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelectorAll('.space-option').length).toBe(1);
    expect(document.querySelector('.space-option')?.textContent).toContain('South');
  });

  it('lists and searches only the active space cellars with Add Cellar', async () => {
    context.ensureLoaded();
    context.chooseSpace('space-1', false);
    const fixture = await openSelector('cellar');
    expect(document.querySelectorAll('.cellar-option').length).toBe(1);
    expect(document.querySelector('.cellar-option')?.textContent).toContain('Reserve');
    expect(document.querySelector('.space-option')).toBeNull();
    expect(document.querySelector('.create-actions')?.textContent).toContain('+ Add Cellar');
    expect(document.querySelector('.create-actions')?.textContent).not.toContain('Add Space');
    const search = document.querySelector<HTMLInputElement>('.search-input')!;
    search.value = 'Collection';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelector('.cellar-option')).toBeNull();
  });

  it('selects the new space cellar automatically and synchronizes its trigger and URL', async () => {
    context.ensureLoaded();
    context.chooseCellar('cellar-1', false);
    const fixture = await openSelector();
    (document.querySelectorAll('.space-option')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(context.selection().space?.id.value).toBe('space-2');
    expect(context.selection().cellar?.id.value).toBe('cellar-2');
    expect(router.parseUrl(router.url).queryParams).toEqual({ spaceId: 'space-2', wineCellarId: 'cellar-2' });
    expect(fixture.nativeElement.querySelector('.cellar-trigger').textContent).toContain('Collection');
    expect(fixture.nativeElement.querySelector('.cellar-trigger').textContent).not.toContain('Reserve');
    fixture.nativeElement.querySelector('.cellar-trigger').click();
    await fixture.whenStable();
    expect(document.querySelectorAll('.cellar-option').length).toBe(1);
    expect(document.querySelector('.cellar-option')?.textContent).toContain('Collection');
  });

  it('defaults to the first cellar but preserves the user choice within the same space', () => {
    directory = { ...directory, cellars: [...directory.cellars, createdCellar] };
    context.ensureLoaded();
    context.chooseSpace('space-1', false);
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    context.chooseCellar('cellar-3', false);
    context.chooseSpace('space-1', false);
    expect(context.selection().cellar?.id.value).toBe('cellar-3');
    context.chooseSpace('space-2', false);
    expect(context.selection().cellar?.id.value).toBe('cellar-2');
  });

  it('leaves no cellar selected only when the chosen space has none', () => {
    directory = { ...directory, cellars: [cellar] };
    context.ensureLoaded();
    context.chooseSpace('space-1', false);
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    context.chooseSpace('space-2', false);
    expect(context.selection().space?.id.value).toBe('space-2');
    expect(context.selection().cellar).toBeNull();
  });

  it('disables the cellar selector only when the account has no spaces', async () => {
    directory = { spaces: [], cellars: [] };
    const fixture = await openSelector();
    const trigger = fixture.nativeElement.querySelector('.cellar-trigger') as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    trigger.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open).toBe('space');
    expect(document.querySelector('.manage-cellars')).toBeNull();
  });

  it('opens contextual cellar management from the cellar footer without stale device parameters', async () => {
    await router.navigateByUrl('/devices?spaceId=space-1&deviceId=device-1');
    context.ensureLoaded();
    context.chooseCellar('cellar-1', false);
    const fixture = await openSelector('cellar');
    const link = document.querySelector<HTMLAnchorElement>('.manage-cellars')!;
    expect(link.textContent).toContain('Manage');
    expect(link.closest('.create-actions')).toBeTruthy();
    expect(link.getAttribute('aria-label')).toBe('Manage cellars in North');
    link.click();
    await fixture.whenStable();
    expect(router.parseUrl(router.url).root.children['primary'].segments[0].path).toBe('cavas');
    expect(router.parseUrl(router.url).queryParams).toEqual({ spaceId: 'space-1', wineCellarId: 'cellar-1' });
    expect(context.selection().space?.id.value).toBe('space-1');
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
  });

  it('offers management for the current space even when it has no cellars', async () => {
    directory = { ...directory, cellars: [] };
    context.ensureLoaded();
    context.chooseSpace('space-2', false);
    const fixture = await openSelector('cellar');
    const link = document.querySelector<HTMLAnchorElement>('.manage-cellars')!;
    expect(link.getAttribute('aria-label')).toContain('South');
    link.click();
    await fixture.whenStable();
    expect(router.url).toBe('/cavas?spaceId=space-2');
  });

  it('navigates to Spaces from a symmetric footer and closes the dropdown without carrying cellar parameters', async () => {
    await router.navigateByUrl('/inventory?spaceId=space-1&wineCellarId=cellar-1');
    const fixture = await openSelector();
    const footer = document.querySelector('.create-actions')!;
    expect(footer.children.length).toBe(2);
    expect(footer.children[0].textContent).toContain('+ Add Space');
    expect(footer.children[1].getAttribute('aria-label')).toBe('Manage Spaces');
    expect(document.querySelector('.manage-cellars')).toBeNull();
    expect(footer.children[1].getAttribute('href')).toBe('/spaces');
    (footer.children[1] as HTMLAnchorElement).click();
    await fixture.whenStable();
    expect(router.url).toBe('/spaces');
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
  });

  for (const kind of ['space', 'cellar'] as const) {
    it(`keeps the ${kind} dropdown limited to search, options and symmetric actions`, async () => {
      context.ensureLoaded();
      context.chooseSpace('space-1', false);
      await openSelector(kind);
      const dropdown = document.querySelector('.workspace-dropdown')!;
      expect(dropdown.getAttribute('aria-label')).toBe(kind === 'space' ? 'Spaces' : 'Cellars');
      expect(dropdown.querySelector('.dropdown-heading, .dropdown-context, h2, form')).toBeNull();
      expect(Array.from(dropdown.children).map((element) => element.classList[0])).toEqual([
        'search-input', 'workspace-options', 'create-actions',
        ...(kind === 'space' ? ['subscription-action'] : []),
      ]);
      expect(dropdown.querySelector('.create-actions')!.children).toHaveLength(2);
    });
  }

  it('allows visiting space management for an empty account without hiding Add Space', async () => {
    directory = { spaces: [], cellars: [] };
    await openSelector();
    expect(document.querySelector<HTMLAnchorElement>('.manage-spaces')!.getAttribute('href')).toBe('/spaces');
    expect(document.querySelector<HTMLButtonElement>('.add-action')!.disabled).toBe(false);
  });

  it('closes the dropdown before opening the limit offer for a Free space with its principal cellar', async () => {
    context.ensureLoaded();
    context.chooseSpace('space-1', false);
    const fixture = await openSelector('cellar');
    const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockImplementation(() => {
      expect(document.querySelector('.workspace-dropdown')).toBeNull();
      return { afterClosed: () => of(undefined) } as MatDialogRef<WineCellarDialogComponent>;
    });
    document.querySelector<HTMLButtonElement>('.create-actions button')!.click();
    await fixture.whenStable();
    expect(open).toHaveBeenCalledWith(CellarLimitModalComponent, expect.objectContaining({
      panelClass: 'device-management-dialog', data: expect.objectContaining({ id: { value: 'space-1' } }),
    }));
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
    expect(fixture.componentInstance.open).toBeNull();
    expect(createCellar).not.toHaveBeenCalled();
  });

  it('creates a space in a full modal without organization fields and activates its default cellar', async () => {
    const fixture = await openSelector();
    (document.querySelectorAll('.create-actions button')[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
    document.querySelector<HTMLButtonElement>('[data-purpose="COLLECTOR"]')!.click();
    const name = document.querySelector<HTMLInputElement>('[name="workspaceName"]')!;
    name.value = 'New space';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('app-create-space-dialog .primary-action')!.click();
    await fixture.whenStable();
    expect(createSpace).toHaveBeenCalledWith('New space', 'COLLECTOR');
    expect(context.selection().space?.id.value).toBe('space-3');
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
    expect(context.selection().cellar).toEqual(defaultCellar);
    expect(fixture.nativeElement.querySelector('.cellar-trigger').textContent).toContain('Default cellar');
    expect(createCellar).not.toHaveBeenCalled();
  });

  it('creates from an empty space using the complete modal with name, description and device selection', async () => {
    directory = { ...directory, cellars: [otherCellar] };
    context.ensureLoaded();
    context.chooseSpace('space-1', false);
    const fixture = await openSelector('cellar');
    expect(fixture.nativeElement.querySelector('.cellar-trigger').textContent).toContain('Sin cavas');
    expect(document.querySelector('.menu-state')?.textContent).toContain('Sin cavas');
    document.querySelector<HTMLButtonElement>('.create-actions button')!.click();
    await fixture.whenStable();
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
    expect(document.querySelector('app-wine-cellar-dialog')?.textContent).toContain('Vincular dispositivo');
    const dialogRef = fixture.debugElement.injector.get(MatDialog).openDialogs[0];
    await firstValueFrom(dialogRef.afterOpened());
    const dialog = dialogRef.componentInstance as WineCellarDialogComponent;
    expect(dialog.data.spaceId).toBe('space-1');
    dialog.form.patchValue({ name: 'New cellar', description: 'Tintos' });
    const completed = firstValueFrom(dialogRef.afterClosed());
    dialog.submit();
    await completed;
    await fixture.whenStable();
    expect(createCellar).toHaveBeenCalledWith('space-1', { name: 'New cellar', description: 'Tintos' });
    expect(context.selection().cellar?.id.value).toBe('cellar-3');
  });

  it('fetches rich cellar metadata lazily rather than treating a missing device field as unlinked', () => {
    context.ensureLoaded();
    context.chooseCellar('cellar-1', false);
    expect(context.selection().cellar).not.toHaveProperty('deviceId');
    const result = vi.fn();
    context.getCellarDetails('cellar-1').subscribe(result);
    context.getCellarDetails('cellar-1').subscribe();
    expect(result).toHaveBeenCalledWith(cellar);
    expect(loadCellars).toHaveBeenCalledOnce();
  });

  it('keeps a successful creation when only the subsequent context refresh fails', () => {
    context.ensureLoaded();
    loadContext.mockReturnValueOnce(throwError(() => new Error('Offline')));
    context.createSpace('New space').subscribe();
    expect(context.selection().space?.id.value).toBe('space-3');
    expect(createSpace).toHaveBeenCalledOnce();
    expect(context.spaces()).toContainEqual(createdSpace);
    expect(context.cellars()).toContainEqual(defaultCellar);
    expect(context.selection().cellar).toEqual(defaultCellar);
    expect(createCellar).not.toHaveBeenCalled();
    expect(context.error()).toContain('Unable to load');
  });

  it('dismisses the overlay with Escape', async () => {
    const fixture = await openSelector();
    document.querySelector('.workspace-dropdown')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
  });

  it('links directly to subscriptions from the space menu, preserving the active space and closing the overlay', async () => {
    const fixture = await openSelector();
    const activeId = context.selection().space!.id.value;
    const link = document.querySelector<HTMLAnchorElement>('.subscription-action')!;
    expect(link.getAttribute('href')).toBe(`/subscription?spaceId=${activeId}`);
    link.click();
    await fixture.whenStable();
    expect(router.url).toBe(`/subscription?spaceId=${activeId}`);
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
  });
});
import { CellarLimitModalComponent } from '../components/cellar-limit-modal/cellar-limit-modal';
