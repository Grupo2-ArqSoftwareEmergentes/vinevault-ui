import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { HeaderComponent } from './header';

describe('Header', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the Topbar focused on branding without subscription actions', () => {
    expect(fixture.nativeElement.querySelector('.brand')?.textContent).toContain('VineVault');
    expect(fixture.nativeElement.querySelector('.header-right')).toBeNull();
    expect(fixture.nativeElement.querySelector('.upgrade-button, .status-pill')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Upgrade to Premium');
  });

  it('emits the sidebar toggle and exposes its current state', () => {
    const emit = vi.spyOn(component.sidebarToggleRequested, 'emit');
    const toggle = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    toggle.click();
    expect(emit).toHaveBeenCalledOnce();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

});
