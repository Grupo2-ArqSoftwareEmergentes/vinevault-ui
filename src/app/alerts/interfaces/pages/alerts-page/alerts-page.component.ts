import { I18nModule } from '../../../../core/i18n/i18n.module';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, catchError, interval, map, of, startWith, switchMap } from 'rxjs';

import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { WorkspaceContextService } from '../../../../shared/services/workspace-context.service';
import { Device } from '../../../../device/domain/services/device-query-service';
import { WorkspaceSpace as Space } from '../../../../shared/models/workspace-context';
import { SpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { DeviceAlertQueryServiceImpl } from '../../../application/internal/queryservices/device-alert-query-service.impl';
import { DeviceAlert } from '../../../domain/services/device-alert-query-service';

type AlertsMode = 'active' | 'history';

type AlertCardItem = Readonly<{
  device: Pick<Device, 'id' | 'name' | 'serialNumber'>;
  alert: DeviceAlert;
}>;

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [
    I18nModule,
    CommonModule,
    MatProgressSpinnerModule,
    HeaderComponent,
    SidebarComponent,
  ],
  templateUrl: './alerts-page.component.html',
  styleUrl: './alerts-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPageComponent implements OnInit, OnDestroy {
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly deviceAlertQueryService = inject(DeviceAlertQueryServiceImpl);
  private readonly workspace = inject(WorkspaceContextService);

  isSidebarOpen = window.innerWidth > 768;
  selectedSpace: Space | null = null;
  loadingAlerts = false;
  errorAlerts = '';
  alertsMode: AlertsMode = 'active';
  activeAlerts: readonly AlertCardItem[] = [];
  historyAlerts: readonly AlertCardItem[] = [];

  private pollingSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.workspace.selectionChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ space }) => {
      const changed = this.selectedSpace?.id.value !== space?.id.value || this.selectedSpace?.role !== space?.role;
      if (!space) this.clearSelectedSpace();
      else if (changed) this.selectSpace(space);
      else { this.selectedSpace = space; this.cdr.markForCheck(); }
    });
    this.workspace.ensureLoaded();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  selectSpace(space: Space): void {
    this.selectedSpace = space;
    this.loadAlerts(space.id);
    this.cdr.markForCheck();
  }

  clearSelectedSpace(): void {
    this.selectedSpace = null;
    this.errorAlerts = '';
    this.loadingAlerts = false;
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
    return `${this.i18n.t('Active')} (${this.activeAlerts.length})`;
  }

  get historyModeLabel(): string {
    return `${this.i18n.t('History')} (${this.historyAlerts.length})`;
  }

  get activeAlertsCount(): number {
    return this.activeAlerts.length;
  }

  get historyAlertsCount(): number {
    return this.historyAlerts.length;
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
        return '°C';
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
    const metric = this.i18n.t(this.metricLabel(item.alert.metric));
    const thresholdMetric = (item.alert.thresholdMetric ?? '').toLowerCase();
    if (item.alert.status === 'RESOLVED') return this.i18n.t('{metric} back within range', { metric });

    if (thresholdMetric.endsWith('_max')) {
      return this.i18n.t('{metric} above maximum', { metric });
    }

    if (thresholdMetric.endsWith('_min')) {
      return this.i18n.t('{metric} below minimum', { metric });
    }

    return this.i18n.t('Threshold reached');
  }

  formatTimestamp(value: string | null): string {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return this.i18n.date(parsed, 'short');
  }

  formatMeasurement(value: string, metric: string): string {
    const number = value.trim() ? Number(value) : NaN;
    if (!Number.isFinite(number)) return '—';
    const unit = this.metricUnit(metric);
    const formatted = new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }).format(number);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  goToDevice(deviceId: string): void {
    void this.router.navigate(['/devices'], { queryParams: { deviceId, spaceId: this.selectedSpace?.id.value } });
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
    return this.deviceAlertQueryService.handleGetAlertsBySpace(spaceId).pipe(
      map(alerts => {
        this.errorAlerts = '';
        const historyAlerts: AlertCardItem[] = alerts
          .filter(alert => alert.spaceId?.value === spaceId.value)
          .map(alert => ({ alert, device: { id: alert.deviceId, name: alert.deviceName || alert.serialNumber || '—', serialNumber: alert.serialNumber || '' } }))
          .sort((a, b) => new Date(b.alert.occurredAt).getTime() - new Date(a.alert.occurredAt).getTime());
        return { historyAlerts, activeAlerts: historyAlerts.filter(item => item.alert.status === 'ACTIVE') };
      }),
      catchError((error) => {
        this.errorAlerts = extractApiErrorMessage(error, 'No se pudieron cargar las alertas');
        // Keep the last successful snapshot during an outage, with a visible error.
        return of({ activeAlerts: this.activeAlerts, historyAlerts: this.historyAlerts });
      })
    );
  }

  private stopPolling(): void {
    if (!this.pollingSubscription) return;
    this.pollingSubscription.unsubscribe();
    this.pollingSubscription = null;
  }
}
