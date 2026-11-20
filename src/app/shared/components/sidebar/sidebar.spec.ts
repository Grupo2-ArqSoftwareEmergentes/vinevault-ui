import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SidebarComponent } from './sidebar';
import { LogoutUseCase } from '../../../iam/domain/use-cases/logout/logout';
import { AuthStateService } from '../../../iam/presentation/state/auth-state/auth-state';
import { WorkspaceScopeService } from '../../services/workspace-scope.service';
import { ownerAccess } from '../../testing/workspace.fixtures';

describe('Sidebar', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter(['overview', 'inventory', 'devices', 'alerts', 'profile'].map(path => ({ path, component: SidebarComponent }))),
        { provide: LogoutUseCase, useValue: { execute: vi.fn(() => of(void 0)) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('retains navigation destinations and English labels', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.nav-item').length).toBe(4);
    expect(element.querySelectorAll('a[href="/subscription"]').length).toBe(0);
    expect(Array.from(element.querySelectorAll('.nav-item')).map((link) => link.getAttribute('aria-label'))).toEqual(['Overview', 'Inventory', 'Devices', 'Alerts']);
    expect(Array.from(element.querySelectorAll('.nav-item')).map(link => link.getAttribute('href'))).toEqual(['/overview', '/inventory', '/devices', '/alerts']);
    expect(Array.from(element.querySelectorAll('.nav-icon')).map(icon => icon.textContent?.trim())).toEqual(['dashboard', 'inventory', 'sensors', 'notifications_active']);
    expect(element.querySelector('a[href="/cavas"]')).toBeNull();
    expect(element.textContent).not.toContain('Wine cellars');
  });

  for (const path of ['overview', 'inventory', 'devices', 'alerts']) {
    it(`retains the active class and aria-current on /${path}`, async () => {
      await TestBed.inject(Router).navigateByUrl(`/${path}`);
      await fixture.whenStable();
      const active = fixture.nativeElement.querySelectorAll('.nav-item.active') as NodeListOf<HTMLAnchorElement>;
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute('href')).toBe(`/${path}`);
      expect(active[0].getAttribute('aria-current')).toBe('page');
    });
  }

  it('activates the profile link on /profile and places it right above the logout separator', async () => {
    const footer = fixture.nativeElement.querySelector('.sidebar-footer') as HTMLElement;
    const profileLink = footer.querySelector('a.profile-link') as HTMLAnchorElement;
    expect(profileLink).toBeTruthy();
    expect(profileLink.getAttribute('href')).toBe('/profile');
    expect(profileLink.nextElementSibling?.classList.contains('logout-section')).toBe(true);
    expect(footer.querySelector('.logout-button')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Explore plans');

    await TestBed.inject(Router).navigateByUrl('/profile');
    await fixture.whenStable();
    expect(profileLink.classList.contains('active')).toBe(true);
    expect(profileLink.getAttribute('aria-current')).toBe('page');
  });

  it('shows user initials and username when expanded and icon-only when collapsed', async () => {
    TestBed.inject(AuthStateService).setAuthenticated({ id: 1, username: 'sommelier1', full_name: 'Ana Sommelier', email: 'ana@example.com' });
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.profile-avatar')?.textContent?.trim()).toBe('AS');
    expect(element.querySelector('.profile-username')?.textContent?.trim()).toBe('sommelier1');

    fixture.componentRef.setInput('isOpen', false);
    await fixture.whenStable();
    expect(element.querySelector('.sidebar-container')?.classList.contains('collapsed')).toBe(true);
    expect(element.querySelector('.profile-avatar')).toBeNull();
    expect(element.querySelector('.profile-meta')).toBeNull();
    expect(element.querySelector('.profile-icon')?.textContent?.trim()).toBe('account_circle');
    expect(element.querySelector('a[href="/profile"]')?.getAttribute('aria-label')).toContain('sommelier1');
    expect(element.querySelector('a[href="/overview"]')?.getAttribute('aria-label')).toBe('Overview');
    expect(element.querySelector('.logout-button')?.getAttribute('aria-label')).toBe('Log out');
    expect(element.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('keeps native keyboard-focusable links in the visual navigation order', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('.nav-item')) as HTMLAnchorElement[];
    for (const link of links) {
      expect(link.tabIndex).toBe(0);
      link.focus();
      expect(document.activeElement).toBe(link);
    }
    expect(links[1].getAttribute('aria-label')).toBe('Inventory');
    expect(links.at(-1)?.closest('nav')?.nextElementSibling?.classList.contains('sidebar-footer')).toBe(true);
  });

  it('does not render plan widgets when the active space or subscription changes', async () => {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-2' }, name: 'Restaurant', subscriptionPlan: 'PRO', spaceType: 'BUSINESS' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.plan-status')).toBeNull();
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.plan-status')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.nav-item')).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('.sidebar-footer a')).toHaveLength(1);
  });

  it('navigates to inventory and closes the mobile sidebar', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(600);
    const close = vi.spyOn(component.closeRequested, 'emit');
    fixture.nativeElement.querySelector('a[href="/inventory"]').click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/inventory');
    expect(close).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('logs out through the existing use case and navigates to login', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('.logout-button').click();
    expect(TestBed.inject(LogoutUseCase).execute).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('requests dismissal from the navigation backdrop', () => {
    const close = vi.spyOn(component.closeRequested, 'emit');
    fixture.nativeElement.querySelector('.sidebar-backdrop').click();
    expect(close).toHaveBeenCalledOnce();
  });
});
