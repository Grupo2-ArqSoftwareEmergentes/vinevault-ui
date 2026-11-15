import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Overview } from './overview';
import { DEVICE_QUERY_SERVICE, Organization } from '../../../../device/domain/services/device-query-service';
import { DeviceAlertQueryServiceImpl } from '../../../../alerts/application/internal/queryservices/device-alert-query-service.impl';
import { ExternalTelemetryEvaluationService } from '../../../../device/application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineInventoryItemQueryServiceImpl } from '../../../../inventory/application/internal/queryservices/wine-inventory-item-query-service.impl';

describe('Overview', () => {
  let component: Overview;
  let fixture: ComponentFixture<Overview>;
  const loadOrganizations = vi.fn(() => of<Organization[]>([]));

  beforeEach(async () => {
    loadOrganizations.mockReset().mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [Overview],
      providers: [
        provideRouter([]),
        { provide: DEVICE_QUERY_SERVICE, useValue: { handleGetCurrentUserOrganizations: loadOrganizations } },
        { provide: DeviceAlertQueryServiceImpl, useValue: {} },
        { provide: ExternalTelemetryEvaluationService, useValue: {} },
        { provide: WineCellarQueryServiceImpl, useValue: {} },
        { provide: WineInventoryItemQueryServiceImpl, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Overview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders all KPI cards, operational rows, and the activity empty state', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.summary-card').length).toBe(4);
    expect(element.querySelectorAll('.status-row').length).toBe(4);
    expect(element.querySelector('.empty-feed')?.textContent).toContain('No recent activity yet.');
    expect(element.textContent).toContain('Organizations');
    expect(element.textContent).toContain('Wine cellars');
    expect(element.textContent).toContain('Devices online');
  });

  it('distinguishes the no-data status from numeric metrics', () => {
    const element = fixture.nativeElement as HTMLElement;
    const badge = element.querySelector('.status-row strong.no-data');
    expect(badge?.textContent?.trim()).toBe('No data');
    expect(element.querySelectorAll('.status-row strong.no-data').length).toBe(1);
    expect(element.querySelectorAll('.summary-copy strong').length).toBe(4);
    expect(element.querySelector('.summary-copy strong.no-data')).toBeNull();
  });

  it('refreshes through the existing query and disables Refresh while loading', async () => {
    const pending = new Subject<Organization[]>();
    loadOrganizations.mockReturnValueOnce(pending);
    const refresh = fixture.nativeElement.querySelector('.refresh-button') as HTMLButtonElement;
    refresh.click();
    await fixture.whenStable();
    expect(loadOrganizations).toHaveBeenCalledTimes(2);
    expect(refresh.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();

    pending.next([]);
    pending.complete();
    await fixture.whenStable();
    expect(refresh.disabled).toBe(false);
    expect(component.refreshedAt).toBeTruthy();
  });

  it('announces query failures and permits another refresh', async () => {
    loadOrganizations.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));
    component.refreshOverview();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Service unavailable');
    expect(component.loading).toBe(false);
  });

  it('connects the header toggle and navigation backdrop to sidebar state', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector<HTMLButtonElement>('.menu-button')!;
    const initial = component.isSidebarOpen;
    toggle.click();
    await fixture.whenStable();
    expect(component.isSidebarOpen).toBe(!initial);
    if (!component.isSidebarOpen) {
      toggle.click();
      await fixture.whenStable();
    }
    element.querySelector<HTMLButtonElement>('.sidebar-backdrop')!.click();
    await fixture.whenStable();
    expect(component.isSidebarOpen).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
