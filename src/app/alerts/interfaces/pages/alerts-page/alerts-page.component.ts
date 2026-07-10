import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, catchError, forkJoin, interval, map, of, startWith, switchMap } from 'rxjs';

import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { OrganizationsPanelComponent } from '../../../../device/interfaces/components/organizations-panel/organizations-panel.component';
import { Space, Device } from '../../../../device/domain/services/device-query-service';
import { SpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { DeviceQueryServiceImpl } from '../../../../device/application/internal/queryservices/device-query-service.impl';
import { DeviceAlertQueryServiceImpl } from '../../../application/internal/queryservices/device-alert-query-service.impl';
import { DeviceAlert } from '../../../domain/services/device-alert-query-service';
import { createGetDevicesBySpaceQuery } from '../../../../device/domain/model/queries/get-devices-by-space.query';
import { createDeviceId } from '../../../../device/domain/model/valueobjects/device-id.value-object';
import { createGetDeviceAlertsByDeviceQuery } from '../../../domain/model/queries/get-device-alerts-by-device.query';

type AlertsMode = 'active' | 'history';

type AlertCardItem = Readonly<{
  device: Device;
  alert: DeviceAlert;
}>;

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    HeaderComponent,
    SidebarComponent,
    OrganizationsPanelComponent,
  ],
  templateUrl: './alerts-page.component.html',
  styleUrl: './alerts-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPageComponent implements OnInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly deviceQueryService = inject(DeviceQueryServiceImpl);
  private readonly deviceAlertQueryService = inject(DeviceAlertQueryServiceImpl);

  isSidebarOpen = true;
  isOrganizationsDrawerOpen = false;
  selectedSpace: Space | null = null;
  loadingAlerts = false;
  errorAlerts = '';
  alertsMode: AlertsMode = 'active';
  activeAlerts: readonly AlertCardItem[] = [];
  historyAlerts: readonly AlertCardItem[] = [];

  private pollingSubscription: Subscription | null = null;

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.stopPolling();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  openOrganizationsDrawer(): void {
    this.isOrganizationsDrawerOpen = true;
  }

  closeOrganizationsDrawer(): void {
    this.isOrganizationsDrawerOpen = false;
  }

  selectSpace(space: Space): void {
    this.closeOrganizationsDrawer();
    this.selectedSpace = space;
    this.loadAlerts(space.id);
    this.cdr.markForCheck();
  }

  clearSelectedSpace(): void {
    this.selectedSpace = null;
    this.errorAlerts = '';
    this.activeAlerts = [];
    this.historyAlerts = [];
    this.stopPolling();
    this.cdr.markForCheck();
  }

  setAlertsMode(mode: AlertsMode): void {
    if (this.alertsMode === mode) return;
    this.alertsMode = mode;
    this.cdr.markForCheck();
  }

  trackByAlertId(_index: number, item: AlertCardItem): string {
    return item.alert.id;
  }

  get filteredAlerts(): readonly AlertCardItem[] {
    return this.alertsMode === 'history' ? this.historyAlerts : this.activeAlerts;
  }

  get activeModeLabel(): string {
    return `Active (${this.activeAlerts.length})`;
  }

  get historyModeLabel(): string {
    return `History (${this.historyAlerts.length})`;
  }

  get activeAlertsCount(): number {
    return this.activeAlerts.length;
  }

  get historyAlertsCount(): number {
    return this.historyAlerts.length;
  }

  alertStatusColor(status: string): string {
    switch ((status ?? '').trim().toUpperCase()) {
      case 'ACTIVE':
        return '#ef4444';
      case 'RESOLVED':
        return '#10b981';
      default:
        return '#6b7280';
    }
  }

  metricLabel(metric: string): string {
    switch ((metric ?? '').trim().toUpperCase()) {
      case 'TEMPERATURE':
        return 'Temperature';
      case 'HUMIDITY':
        return 'Humidity';
      default:
        return metric;
    }
  }

  metricUnit(metric: string): string {
    switch ((metric ?? '').trim().toUpperCase()) {
      case 'TEMPERATURE':
        return 'C';
      case 'HUMIDITY':
        return '%';
      default:
        return '';
    }
  }

  thresholdLabel(metric: string): string {
    switch ((metric ?? '').trim().toLowerCase()) {
      case 'temperature_min':
        return 'Temperature min';
      case 'temperature_max':
        return 'Temperature max';
      case 'humidity_min':
        return 'Humidity min';
      case 'humidity_max':
        return 'Humidity max';
      default:
        return metric;
    }
  }

  alertSummary(item: AlertCardItem): string {
    const metric = this.metricLabel(item.alert.metric);
    const thresholdMetric = (item.alert.thresholdMetric ?? '').toLowerCase();
    const actual = this.formatMeasurement(item.alert.actualValue, item.alert.metric);
    const threshold = this.formatMeasurement(item.alert.thresholdValue, item.alert.metric);

    if (thresholdMetric.endsWith('_max')) {
      return `${metric} above max: ${actual} vs ${threshold}`;
    }

    if (thresholdMetric.endsWith('_min')) {
      return `${metric} below min: ${actual} vs ${threshold}`;
    }

    return `${metric}: ${actual} vs ${threshold}`;
  }

  alertComparisonLabel(item: AlertCardItem): string {
    const thresholdMetric = (item.alert.thresholdMetric ?? '').toLowerCase();
    if (item.alert.status.trim().toUpperCase() === 'RESOLVED') return 'Resolved';
    if (thresholdMetric.endsWith('_max')) return 'Above maximum';
    if (thresholdMetric.endsWith('_min')) return 'Below minimum';
    return 'Threshold reached';
  }

  formatTimestamp(value: string | null): string {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleString();
  }

  formatMeasurement(value: string, metric: string): string {
    const unit = this.metricUnit(metric);
    return unit ? `${value} ${unit}` : value;
  }

  goToDevice(deviceId: string): void {
    void this.router.navigate(['/devices'], { queryParams: { deviceId } });
  }

  private loadAlerts(spaceId: SpaceId): void {
    this.loadingAlerts = true;
    this.errorAlerts = '';
    this.activeAlerts = [];
    this.historyAlerts = [];
    this.cdr.markForCheck();

    this.stopPolling();
    this.pollingSubscription = interval(15_000)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchAlertsForSpace(spaceId))
      )
      .subscribe({
        next: (result) => {
          this.activeAlerts = result.activeAlerts;
          this.historyAlerts = result.historyAlerts;
          this.loadingAlerts = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorAlerts = extractApiErrorMessage(error, 'No se pudieron cargar las alertas');
          this.loadingAlerts = false;
          this.cdr.markForCheck();
        },
      });
  }

  private fetchAlertsForSpace(spaceId: SpaceId) {
    return this.deviceQueryService.handleGetDevicesBySpace(createGetDevicesBySpaceQuery(spaceId, 0, 100)).pipe(
      switchMap((page) => {
        const devices = page.content;
        if (devices.length === 0) {
          return of({ activeAlerts: [] as AlertCardItem[], historyAlerts: [] as AlertCardItem[] });
        }

        return forkJoin(
          devices.map((device) =>
            forkJoin({
              active: this.deviceAlertQueryService
                .handleGetDeviceAlertsByDevice(createGetDeviceAlertsByDeviceQuery(createDeviceId(device.id.value), true))
                .pipe(catchError(() => of([] as readonly DeviceAlert[]))),
              history: this.deviceAlertQueryService
                .handleGetDeviceAlertsByDevice(createGetDeviceAlertsByDeviceQuery(createDeviceId(device.id.value), false))
                .pipe(catchError(() => of([] as readonly DeviceAlert[]))),
            }).pipe(
              map(({ active, history }) => ({
                activeAlerts: active.map((alert) => ({ device, alert })),
                historyAlerts: history.map((alert) => ({ device, alert })),
              }))
            )
          )
        ).pipe(
          map((groups) => {
            const activeAlerts = groups
              .flatMap((group) => group.activeAlerts)
              .sort((a, b) => new Date(b.alert.occurredAt).getTime() - new Date(a.alert.occurredAt).getTime());

            const historyAlerts = groups
              .flatMap((group) => group.historyAlerts)
              .sort((a, b) => new Date(b.alert.occurredAt).getTime() - new Date(a.alert.occurredAt).getTime());

            return { activeAlerts, historyAlerts };
          })
        );
      }),
      catchError((error) => {
        this.errorAlerts = extractApiErrorMessage(error, 'No se pudieron cargar las alertas');
        return of({ activeAlerts: [] as AlertCardItem[], historyAlerts: [] as AlertCardItem[] });
      })
    );
  }

  private stopPolling(): void {
    if (!this.pollingSubscription) return;
    this.pollingSubscription.unsubscribe();
    this.pollingSubscription = null;
  }
}
