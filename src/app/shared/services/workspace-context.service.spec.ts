import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { filter, firstValueFrom, of, take, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkspaceContextService } from './workspace-context.service';
import { WorkspaceApiService } from './workspace-api.service';
import { WorkspaceDirectory } from '../models/workspace-context';
import { WorkspaceSwitcherComponent } from '../components/workspace-switcher/workspace-switcher';
import { Organization, Space } from '../../device/domain/services/device-query-service';
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
const first: Space = { id: createSpaceId('space-1'), name: 'North', organizationId: organization.id, ownerUserId: organization.ownerUserId, createdAt: null, updatedAt: null };
const second: Space = { ...first, id: createSpaceId('space-2'), name: 'South' };
const cellar: WineCellar = { id: createWineCellarId('cellar-1'), spaceId: first.id, name: 'Reserve', description: null, deviceId: { value: 'device-1' }, createdAt: null, updatedAt: null };
const otherCellar: WineCellar = { ...cellar, id: createWineCellarId('cellar-2'), spaceId: second.id, name: 'Collection' };
const createdSpace: Space = { ...first, id: createSpaceId('space-3'), name: 'New space' };
const createdCellar: WineCellar = { ...cellar, id: createWineCellarId('cellar-3'), name: 'New cellar' };

describe('Global workspace directory and selector', () => {
  let context: WorkspaceContextService;
  let router: Router;
  let directory: WorkspaceDirectory;
  const loadContext = vi.fn(() => of<WorkspaceDirectory>(directory));
  const loadCellars = vi.fn((spaceId: string) => of(spaceId === 'space-1' ? [cellar] : [otherCellar]));
  const createSpace = vi.fn(() => of(createdSpace));
  const createCellar = vi.fn(() => of(createdCellar));

  beforeEach(async () => {
    directory = {
      spaces: [first, second].map(({ id, name }) => ({ id, name })),
      cellars: [cellar, otherCellar].map(({ id, name, spaceId }) => ({ id, name, spaceId })),
    };
    loadContext.mockReset().mockImplementation(() => of(directory));
    loadCellars.mockReset().mockImplementation((spaceId: string) => of(spaceId === 'space-1' ? [cellar] : [otherCellar]));
    createSpace.mockReset().mockImplementation(() => {
      directory = { ...directory, spaces: [...directory.spaces, createdSpace] };
      return of(createdSpace);
    });
    createCellar.mockReset().mockImplementation(() => {
      directory = { ...directory, cellars: [...directory.cellars, createdCellar] };
      return of(createdCellar);
    });
    await TestBed.configureTestingModule({
      imports: [WorkspaceSwitcherComponent],
      providers: [
        provideRouter(['', 'devices', 'alerts', 'cavas', 'inventory'].map((path) => ({ path, component: WorkspaceTestPage }))),
        { provide: WorkspaceApiService, useValue: { getContext: loadContext, createSpace } },
        { provide: WineCellarQueryServiceImpl, useValue: { getWineCellarsBySpace: loadCellars } },
        { provide: WineCellarCommandServiceImpl, useValue: { createWineCellar: createCellar } },
      ],
    }).compileComponents();
    context = TestBed.inject(WorkspaceContextService);
    router = TestBed.inject(Router);
  });

  it('shares one directory load instead of reloading for every view', () => {
    context.ensureLoaded();
    context.ensureLoaded();
    expect(loadContext).toHaveBeenCalledOnce();
    expect(loadCellars).not.toHaveBeenCalled();
    expect(context.selection().space).toBeNull();
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
    expect(context.selection().cellar).toBeNull();
    await router.navigateByUrl('/cavas?spaceId=space-2');
    expect(context.selection().space?.id.value).toBe('space-2');
    expect(context.selection().cellar).toBeNull();
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
    expect(createSpace).toHaveBeenCalledWith('New space');
    expect(loadContext).toHaveBeenCalledTimes(2);
    expect(context.selection().space?.id.value).toBe('space-3');
  });

  async function openSelector(): Promise<ComponentFixture<WorkspaceSwitcherComponent>> {
    const fixture = TestBed.createComponent(WorkspaceSwitcherComponent);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.workspace-trigger').click();
    await fixture.whenStable();
    return fixture;
  }

  it('selects a cellar in one click and closes the accessible overlay', async () => {
    const fixture = await openSelector();
    const option = document.querySelector<HTMLButtonElement>('.cellar-option')!;
    expect(option.textContent).toContain('Reserve');
    option.click();
    await fixture.whenStable();
    expect(context.selection().cellar?.id.value).toBe('cellar-1');
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
    expect(fixture.nativeElement.querySelector('.workspace-trigger').getAttribute('aria-expanded')).toBe('false');
  });

  it('filters by cellar name without nested organization navigation', async () => {
    const fixture = await openSelector();
    const search = document.querySelector<HTMLInputElement>('.search-input')!;
    search.value = 'Collection';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelectorAll('.space-option').length).toBe(1);
    expect(document.querySelectorAll('.cellar-option').length).toBe(1);
    expect(document.querySelector('.cellar-option')?.textContent).toContain('Collection');
  });

  it('creates a space inline without organization fields and activates it', async () => {
    const fixture = await openSelector();
    (document.querySelectorAll('.create-actions button')[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    const name = document.querySelector<HTMLInputElement>('[name="workspaceName"]')!;
    name.value = 'New space';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('.create-footer .primary-action')!.click();
    await fixture.whenStable();
    expect(createSpace).toHaveBeenCalledWith('New space');
    expect(context.selection().space?.id.value).toBe('space-3');
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
  });

  it('creates a cellar inline without changing its existing API payload', async () => {
    const fixture = await openSelector();
    (document.querySelectorAll('.create-actions button')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.componentInstance.name = 'New cellar';
    fixture.componentInstance.save();
    await fixture.whenStable();
    expect(createCellar).toHaveBeenCalledWith('space-1', { name: 'New cellar', description: null });
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
    expect(context.error()).toContain('Unable to load');
  });

  it('dismisses the overlay with Escape', async () => {
    const fixture = await openSelector();
    document.querySelector('.workspace-dropdown')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(document.querySelector('.workspace-dropdown')).toBeNull();
  });
});
