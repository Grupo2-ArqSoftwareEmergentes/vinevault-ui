import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { HeaderComponent } from './header';
import { MockPaymentService } from '../plans/services/mock-payment.service';
import { CheckoutModalComponent } from '../plans/components/checkout-modal/checkout-modal';

describe('Header', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  const plan = signal<'FREE' | 'PREMIUM'>('FREE');

  beforeEach(async () => {
    plan.set('FREE');
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [{ provide: MockPaymentService, useValue: {
        subscription: signal({ plan: 'FREE' }), effectivePlan: plan, resetToFree: vi.fn(),
      } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the upgrade action connected to checkout with English copy', () => {
    const dialog = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockImplementation(() => undefined as never);
    const upgrade = fixture.nativeElement.querySelector('.upgrade-button') as HTMLButtonElement;
    expect(upgrade.textContent).toContain('Upgrade to Premium');
    upgrade.click();
    expect(dialog).toHaveBeenCalledWith(CheckoutModalComponent, expect.objectContaining({ maxWidth: '95vw' }));
  });

  it('emits the sidebar toggle and exposes its current state', () => {
    const emit = vi.spyOn(component.sidebarToggleRequested, 'emit');
    const toggle = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    toggle.click();
    expect(emit).toHaveBeenCalledOnce();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the premium status instead of the upgrade button for Premium', async () => {
    plan.set('PREMIUM');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.upgrade-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.premium-active').textContent).toContain('Premium Mode');
  });
});
