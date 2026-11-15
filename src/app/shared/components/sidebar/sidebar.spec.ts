import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { signal } from '@angular/core';

import { SidebarComponent } from './sidebar';
import { LogoutUseCase } from '../../../iam/domain/use-cases/logout/logout';
import { MockPaymentService } from '../plans/services/mock-payment.service';

describe('Sidebar', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  const plan = signal<'FREE' | 'PREMIUM'>('FREE');

  beforeEach(async () => {
    plan.set('FREE');
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([{ path: 'subscription', component: SidebarComponent }]),
        { provide: MockPaymentService, useValue: { effectivePlan: plan } },
        { provide: LogoutUseCase, useValue: { execute: vi.fn(() => of(void 0)) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('retains navigation destinations and English labels', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.nav-item').length).toBe(5);
    expect(element.querySelectorAll('a[href="/subscription"]').length).toBe(1);
    expect(element.querySelector('a[href="/cavas"]')?.textContent).toContain('Wine cellars');
  });

  it('keeps icon-only links and logout accessible when collapsed', async () => {
    fixture.componentRef.setInput('isOpen', false);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.sidebar-container')?.classList.contains('collapsed')).toBe(true);
    expect(element.querySelector('a[href="/overview"]')?.getAttribute('aria-label')).toBe('Overview');
    expect(element.querySelector('.logout-button')?.getAttribute('aria-label')).toBe('Log out');
    expect(element.querySelector('.plan-status')?.getAttribute('aria-label')).toContain('Free plan');
    expect(element.querySelector('.plan-status mat-icon')).toBeTruthy();
    expect(element.querySelector('.plan-copy')).toBeNull();
    expect(element.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('places the Free plan badge above the logout separator', () => {
    const badge = fixture.nativeElement.querySelector('.plan-status') as HTMLAnchorElement;
    expect(badge.textContent).toContain('Free plan');
    expect(badge.textContent).toContain('Explore Premium');
    expect(badge.classList.contains('plan-status--premium')).toBe(false);
    expect(badge.nextElementSibling?.classList.contains('logout-section')).toBe(true);
    expect(badge.nextElementSibling?.querySelector('.logout-button')).toBeTruthy();
  });

  it('reacts to Premium activation and downgrading without reloading', async () => {
    plan.set('PREMIUM');
    await fixture.whenStable();
    const badge = fixture.nativeElement.querySelector('.plan-status') as HTMLAnchorElement;
    expect(badge.classList.contains('plan-status--premium')).toBe(true);
    expect(badge.textContent).toContain('Premium plan');
    expect(badge.textContent).toContain('PRO Active');
    expect(badge.getAttribute('aria-label')).toContain('Manage subscription');
    plan.set('FREE');
    await fixture.whenStable();
    expect(badge.classList.contains('plan-status--premium')).toBe(false);
    expect(badge.textContent).toContain('Free plan');
  });

  it('navigates directly to subscription and closes the mobile sidebar', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(600);
    const close = vi.spyOn(component.closeRequested, 'emit');
    fixture.nativeElement.querySelector('.plan-status').click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/subscription');
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
