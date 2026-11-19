import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SidebarComponent } from './sidebar';
import { LogoutUseCase } from '../../../iam/domain/use-cases/logout/logout';
import { WorkspaceScopeService } from '../../services/workspace-scope.service';
import { ownerAccess } from '../../testing/workspace.fixtures';

describe('Sidebar', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter(['overview', 'inventory', 'devices', 'alerts'].map(path => ({ path, component: SidebarComponent }))),
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

  it('keeps icon-only links and logout accessible when collapsed', async () => {
    fixture.componentRef.setInput('isOpen', false);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.sidebar-container')?.classList.contains('collapsed')).toBe(true);
    expect(element.querySelector('a[href="/overview"]')?.getAttribute('aria-label')).toBe('Overview');
    expect(element.querySelector('.logout-button')?.getAttribute('aria-label')).toBe('Log out');
    expect(element.querySelector('.plan-status')).toBeNull();
    expect(element.querySelector('.plan-copy')).toBeNull();
    expect(element.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('keeps only logout in the footer', () => {
    const footer = fixture.nativeElement.querySelector('.sidebar-footer') as HTMLElement;
    expect(footer.querySelectorAll('a')).toHaveLength(0);
    expect(footer.querySelectorAll('button')).toHaveLength(1);
    expect(footer.querySelector('.logout-button')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Explore plans');
  });

  it('does not render plan widgets when the active space or subscription changes', async () => {
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-2' }, name: 'Restaurant', subscriptionPlan: 'PRO', spaceType: 'BUSINESS' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.plan-status')).toBeNull();
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.plan-status')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('a')).toHaveLength(4);
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
