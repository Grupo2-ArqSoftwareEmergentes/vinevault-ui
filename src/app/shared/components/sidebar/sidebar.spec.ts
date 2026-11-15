import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SidebarComponent } from './sidebar';
import { LogoutUseCase } from '../../../iam/domain/use-cases/logout/logout';

describe('Sidebar', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
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
    expect(element.querySelectorAll('.nav-item').length).toBe(6);
    expect(element.querySelector('a[href="/subscription"]')?.textContent).toContain('Subscription');
    expect(element.querySelector('a[href="/cavas"]')?.textContent).toContain('Wine cellars');
  });

  it('keeps icon-only links and logout accessible when collapsed', async () => {
    fixture.componentRef.setInput('isOpen', false);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.sidebar-container')?.classList.contains('collapsed')).toBe(true);
    expect(element.querySelector('a[href="/overview"]')?.getAttribute('aria-label')).toBe('Overview');
    expect(element.querySelector('.logout-button')?.getAttribute('aria-label')).toBe('Log out');
    expect(element.querySelector('.sidebar-backdrop')).toBeNull();
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
