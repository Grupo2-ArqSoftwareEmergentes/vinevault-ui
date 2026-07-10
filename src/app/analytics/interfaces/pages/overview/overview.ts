import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import {
  DEVICE_QUERY_SERVICE,
  Device,
  DeviceQueryService,
  Organization,
  Space,
} from '../../../../device/domain/services/device-query-service';
import { createGetCurrentUserOrganizationsQuery } from '../../../../device/domain/model/queries/get-current-user-organizations.query';
import { createGetSpacesByOrganizationQuery } from '../../../../device/domain/model/queries/get-spaces-by-organization.query';
import { createOrganizationId } from '../../../../device/domain/model/valueobjects/organization-id.value-object';
import { createGetDevicesBySpaceQuery } from '../../../../device/domain/model/queries/get-devices-by-space.query';
import { createDeviceId } from '../../../../device/domain/model/valueobjects/device-id.value-object';
import { DeviceAlertQueryServiceImpl } from '../../../../alerts/application/internal/queryservices/device-alert-query-service.impl';
import { DeviceAlert } from '../../../../alerts/domain/services/device-alert-query-service';
import { createGetDeviceAlertsByDeviceQuery } from '../../../../alerts/domain/model/queries/get-device-alerts-by-device.query';
import { ExternalTelemetryEvaluationService, DeviceTelemetrySnapshot } from '../../../../device/application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { WineCellar, WineCellarQueryService } from '../../../../cava/domain/services/wine-cellar-query-service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import {
  WineInventoryItem,
  WineInventoryItemQueryService,
} from '../../../../inventory/domain/services/wine-inventory-item-query-service';
import { WineInventoryItemQueryServiceImpl } from '../../../../inventory/application/internal/queryservices/wine-inventory-item-query-service.impl';

interface SummaryCard {
  label: string;
  value: string;
  icon: string;
  hint: string;
}

interface ActivityItem {
  title: string;
  description: string;
  time: string;
  color: string;
  sortAt: number;
}

interface StatusRow {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
  note: string;
}

interface OverviewViewModel {
  heroLead: string;
  summaryCards: readonly SummaryCard[];
  activityItems: readonly ActivityItem[];
  statusRows: readonly StatusRow[];
}

interface AlertActivity {
  device: Device;
  alert: DeviceAlert;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    HeaderComponent,
    SidebarComponent,
  ],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly deviceQueryService = inject(DEVICE_QUERY_SERVICE) as DeviceQueryService;
  private readonly deviceAlertQueryService = inject(DeviceAlertQueryServiceImpl);
  private readonly telemetryService = inject(ExternalTelemetryEvaluationService);
  private readonly wineCellarQueryService = inject(WineCellarQueryServiceImpl) as WineCellarQueryService;
  private readonly wineInventoryItemQueryService = inject(WineInventoryItemQueryServiceImpl) as WineInventoryItemQueryService;

  isSidebarOpen = true;
  loading = false;
  error = '';
  refreshedAt: Date | null = null;
  heroLead = 'Loading live data...';
  summaryCards: readonly SummaryCard[] = this.createEmptySummaryCards();
  activityItems: readonly ActivityItem[] = [];
  statusRows: readonly StatusRow[] = this.createEmptyStatusRows();

  ngOnInit(): void {
    this.loadOverview();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  refreshOverview(): void {
    this.loadOverview();
  }

  get refreshedLabel(): string {
    if (!this.refreshedAt) return 'Not refreshed yet';
    return `Updated ${this.formatRelativeTime(this.refreshedAt.toISOString())}`;
  }

  get hasOverviewData(): boolean {
    return this.summaryCards.some((card) => card.value !== '0') || this.activityItems.length > 0;
  }

  trackByCardLabel(_index: number, card: SummaryCard): string {
    return card.label;
  }

  trackByActivity(_index: number, item: ActivityItem): string {
    return `${item.sortAt}-${item.title}`;
  }

  trackByStatusRow(_index: number, row: StatusRow): string {
    return row.label;
  }

  statusToneClass(tone: StatusRow['tone']): string {
    return tone;
  }

  private loadOverview(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = '';
    this.heroLead = 'Loading live data...';
    this.summaryCards = this.createEmptySummaryCards();
    this.activityItems = [];
    this.statusRows = this.createEmptyStatusRows();
    this.cdr.markForCheck();

    this.deviceQueryService
      .handleGetCurrentUserOrganizations(createGetCurrentUserOrganizationsQuery())
      .pipe(
        switchMap((organizations) => this.buildOverviewView(organizations)),
        catchError((error: unknown) => {
          this.error = error instanceof Error ? error.message : 'No se pudo cargar el overview';
          return of(this.createEmptyView());
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((view) => {
        this.applyView(view);
        this.loading = false;
        this.refreshedAt = new Date();
        this.cdr.markForCheck();
      });
  }

  private applyView(view: OverviewViewModel): void {
    this.heroLead = view.heroLead;
    this.summaryCards = view.summaryCards;
    this.activityItems = view.activityItems;
    this.statusRows = view.statusRows;
  }

  private buildOverviewView(organizations: readonly Organization[]) {
    if (organizations.length === 0) {
      return of(this.createEmptyView('No organizations are available for this account yet.'));
    }

    return this.fetchSpaces(organizations).pipe(
      switchMap((spaces) =>
        this.fetchDevices(spaces).pipe(
          switchMap((devices) =>
            forkJoin({
              telemetryByDeviceId: this.fetchLatestTelemetryByDevices(devices),
              activeAlerts: this.fetchActiveAlertsByDevices(devices),
              inventoryStats: this.fetchInventoryStats(spaces),
            }).pipe(
              map(({ telemetryByDeviceId, activeAlerts, inventoryStats }) =>
                this.createViewModel(organizations, spaces, devices, telemetryByDeviceId, activeAlerts, inventoryStats)
              )
            )
          )
        )
      )
    );
  }

  private fetchSpaces(organizations: readonly Organization[]) {
    if (organizations.length === 0) return of([] as readonly Space[]);

    return forkJoin(
      organizations.map((organization) =>
        this.deviceQueryService
          .handleGetSpacesByOrganization(createGetSpacesByOrganizationQuery(createOrganizationId(organization.id.value)))
          .pipe(catchError(() => of([] as readonly Space[])))
      )
    ).pipe(map((spacesGroups) => spacesGroups.flat()));
  }

  private fetchDevices(spaces: readonly Space[]) {
    if (spaces.length === 0) return of([] as readonly Device[]);

    return forkJoin(
      spaces.map((space) =>
        this.deviceQueryService
          .handleGetDevicesBySpace(createGetDevicesBySpaceQuery(space.id, 0, 100))
          .pipe(
            map((page) => page.content),
            catchError(() => of([] as readonly Device[]))
          )
      )
    ).pipe(map((deviceGroups) => deviceGroups.flat()));
  }

  private fetchLatestTelemetryByDevices(devices: readonly Device[]) {
    if (devices.length === 0) return of({} as Record<string, DeviceTelemetrySnapshot | null>);

    return forkJoin(
      devices.map((device) =>
        this.telemetryService.fetchLatestTelemetryByDevice(device.id.value).pipe(
          catchError(() => of(null)),
          map((snapshot) => [device.id.value, snapshot] as const)
        )
      )
    ).pipe(map((entries) => Object.fromEntries(entries) as Record<string, DeviceTelemetrySnapshot | null>));
  }

  private fetchActiveAlertsByDevices(devices: readonly Device[]) {
    if (devices.length === 0) return of([] as readonly AlertActivity[]);

    return forkJoin(
      devices.map((device) =>
        this.deviceAlertQueryService
          .handleGetDeviceAlertsByDevice(createGetDeviceAlertsByDeviceQuery(createDeviceId(device.id.value), true))
          .pipe(
            catchError(() => of([] as readonly DeviceAlert[])),
            map((alerts) => alerts.map((alert) => ({ device, alert })))
          )
      )
    ).pipe(
      map((groups) =>
        groups
          .flat()
          .sort((a, b) => new Date(b.alert.occurredAt).getTime() - new Date(a.alert.occurredAt).getTime())
      )
    );
  }

  private fetchInventoryStats(spaces: readonly Space[]) {
    if (spaces.length === 0) {
      return of({ cellarCount: 0, inventoryItemCount: 0, cellarsWithInventory: 0 });
    }

    return forkJoin(
      spaces.map((space) =>
        this.wineCellarQueryService.getWineCellarsBySpace(space.id.value).pipe(catchError(() => of([] as readonly WineCellar[])))
      )
    ).pipe(
      switchMap((cellarsGroups) => {
        const cellars = cellarsGroups.flat();
        if (cellars.length === 0) {
          return of({ cellarCount: 0, inventoryItemCount: 0, cellarsWithInventory: 0 });
        }

        return forkJoin(
          cellars.map((cellar) =>
            this.wineInventoryItemQueryService.getInventoryItemsByWineCellar(cellar.id.value).pipe(
              catchError(() => of([] as readonly WineInventoryItem[]))
            )
          )
        ).pipe(
          map((inventoryGroups) => {
            const inventoryItemCount = inventoryGroups.reduce((total, items) => total + items.length, 0);
            const cellarsWithInventory = inventoryGroups.filter((items) => items.length > 0).length;
            return { cellarCount: cellars.length, inventoryItemCount, cellarsWithInventory };
          })
        );
      })
    );
  }

  private createViewModel(
    organizations: readonly Organization[],
    spaces: readonly Space[],
    devices: readonly Device[],
    telemetryByDeviceId: Record<string, DeviceTelemetrySnapshot | null>,
    activeAlerts: readonly AlertActivity[],
    inventoryStats: { cellarCount: number; inventoryItemCount: number; cellarsWithInventory: number }
  ): OverviewViewModel {
    const onlineDevices = devices.filter((device) => device.status === 'ONLINE');
    const devicesWithTelemetry = devices.filter((device) => telemetryByDeviceId[device.id.value]);
    const freshTelemetry = devices.filter((device) => {
      const snapshot = telemetryByDeviceId[device.id.value];
      return snapshot?.occurredAt ? this.minutesSince(snapshot.occurredAt) <= 15 : false;
    });

    const latestTelemetryAt = this.latestTimestamp(
      devices
        .map((device) => telemetryByDeviceId[device.id.value]?.occurredAt ?? null)
        .filter((value): value is string => !!value)
    );

    const summaryCards: SummaryCard[] = [
      {
        label: 'Organizations',
        value: this.formatNumber(organizations.length),
        icon: 'domain',
        hint: 'Accessible organizations in this account',
      },
      {
        label: 'Spaces',
        value: this.formatNumber(spaces.length),
        icon: 'apartment',
        hint: 'Spaces currently available to monitor',
      },
      {
        label: 'Devices online',
        value: this.formatNumber(onlineDevices.length),
        icon: 'sensors',
        hint: `${devicesWithTelemetry.length} devices reported telemetry`,
      },
      {
        label: 'Active alerts',
        value: this.formatNumber(activeAlerts.length),
        icon: 'warning',
        hint: inventoryStats.cellarsWithInventory > 0
          ? `${inventoryStats.cellarsWithInventory} cavas with inventory data`
          : 'No active alerts were found',
      },
    ];

    const activityItems = this.createActivityItems(devices, telemetryByDeviceId, activeAlerts);

    const heroLeadParts = [
      `${organizations.length} organizations`,
      `${spaces.length} spaces`,
      `${devices.length} devices`,
      `${inventoryStats.cellarCount} cavas`,
    ];

    const statusRows: StatusRow[] = [
      {
        label: 'Wine cellars',
        value: this.formatNumber(inventoryStats.cellarCount),
        tone: 'info',
        note: 'Cavas discovered across all spaces',
      },
      {
        label: 'Inventory items',
        value: this.formatNumber(inventoryStats.inventoryItemCount),
        tone: 'success',
        note: 'Rows loaded from the inventory endpoints',
      },
      {
        label: 'Fresh telemetry',
        value: this.formatNumber(freshTelemetry.length),
        tone: freshTelemetry.length > 0 ? 'success' : 'warning',
        note: 'Devices reporting within the last 15 minutes',
      },
      {
        label: 'Latest sync',
        value: latestTelemetryAt ? this.formatRelativeTime(latestTelemetryAt) : 'No data',
        tone: latestTelemetryAt ? 'info' : 'neutral',
        note: latestTelemetryAt ? 'Most recent telemetry received' : 'Waiting for the first report',
      },
    ];

    return {
      heroLead: `Real data from ${heroLeadParts.join(' · ')}.`,
      summaryCards,
      activityItems,
      statusRows,
    };
  }

  private createActivityItems(
    devices: readonly Device[],
    telemetryByDeviceId: Record<string, DeviceTelemetrySnapshot | null>,
    activeAlerts: readonly AlertActivity[]
  ): readonly ActivityItem[] {
    const alertItems: ActivityItem[] = activeAlerts.slice(0, 6).map(({ device, alert }) => ({
      title: `${device.name} alert`,
      description: this.alertDescription(alert),
      time: this.formatRelativeTime(alert.occurredAt),
      color: this.alertColor(alert.status),
      sortAt: new Date(alert.occurredAt).getTime(),
    }));

    const telemetryItems: ActivityItem[] = devices
      .map((device) => {
        const snapshot = telemetryByDeviceId[device.id.value];
        if (!snapshot?.occurredAt) return null;

        return {
          title: `${device.name} telemetry`,
          description: this.telemetryDescription(snapshot),
          time: this.formatRelativeTime(snapshot.occurredAt),
          color: this.telemetryColor(snapshot),
          sortAt: new Date(snapshot.occurredAt).getTime(),
        } satisfies ActivityItem;
      })
      .filter((item): item is ActivityItem => item !== null)
      .slice(0, 6);

    return [...alertItems, ...telemetryItems]
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, 6);
  }

  private telemetryDescription(snapshot: DeviceTelemetrySnapshot): string {
    const temperature = snapshot.temperature != null ? `${snapshot.temperature.toFixed(1)} °C` : 'Temperature n/a';
    const humidity = snapshot.humidity != null ? `${snapshot.humidity.toFixed(1)} %` : 'Humidity n/a';
    const signal = snapshot.connectivitySignalStrength != null ? `Signal ${snapshot.connectivitySignalStrength} dBm` : 'No signal data';
    return `${temperature} · ${humidity} · ${signal}`;
  }

  private alertDescription(alert: DeviceAlert): string {
    const metric = this.metricLabel(alert.metric);
    const threshold = this.formatMeasurement(alert.thresholdValue, alert.metric);
    const actual = this.formatMeasurement(alert.actualValue, alert.metric);

    if (alert.status.trim().toUpperCase() === 'RESOLVED') {
      return `${metric} resolved at ${actual} against ${threshold}`;
    }

    return `${metric} at ${actual} versus ${threshold}`;
  }

  private telemetryColor(snapshot: DeviceTelemetrySnapshot): string {
    if (snapshot.temperature != null && snapshot.temperature >= 28) return '#ef4444';
    if (snapshot.humidity != null && snapshot.humidity <= 20) return '#f59e0b';
    return '#10b981';
  }

  private alertColor(status: string): string {
    switch (status.trim().toUpperCase()) {
      case 'ACTIVE':
        return '#ef4444';
      case 'RESOLVED':
        return '#10b981';
      default:
        return '#6b7280';
    }
  }

  private metricLabel(metric: string): string {
    switch ((metric ?? '').trim().toUpperCase()) {
      case 'TEMPERATURE':
        return 'Temperature';
      case 'HUMIDITY':
        return 'Humidity';
      default:
        return metric;
    }
  }

  private formatMeasurement(value: string, metric: string): string {
    const unit = this.metricUnit(metric);
    return unit ? `${value} ${unit}` : value;
  }

  private metricUnit(metric: string): string {
    switch ((metric ?? '').trim().toUpperCase()) {
      case 'TEMPERATURE':
        return '°C';
      case 'HUMIDITY':
        return '%';
      default:
        return '';
    }
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  private formatRelativeTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Just now';

    const diffMs = Date.now() - parsed.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} d ago`;

    return parsed.toLocaleDateString();
  }

  private minutesSince(value: string): number {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
    return Math.floor((Date.now() - parsed.getTime()) / 60_000);
  }

  private latestTimestamp(values: readonly string[]): string | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return sorted[0] ?? null;
  }

  private createEmptyView(message = 'No data was found for this account yet.'): OverviewViewModel {
    return {
      heroLead: message,
      summaryCards: this.createEmptySummaryCards(),
      activityItems: [],
      statusRows: this.createEmptyStatusRows(),
    };
  }

  private createEmptySummaryCards(): readonly SummaryCard[] {
    return [
      { label: 'Organizations', value: '0', icon: 'domain', hint: 'No organizations loaded yet' },
      { label: 'Spaces', value: '0', icon: 'apartment', hint: 'No spaces loaded yet' },
      { label: 'Devices online', value: '0', icon: 'sensors', hint: 'No live devices yet' },
      { label: 'Active alerts', value: '0', icon: 'warning', hint: 'No alert data yet' },
    ];
  }

  private createEmptyStatusRows(): readonly StatusRow[] {
    return [
      { label: 'Wine cellars', value: '0', tone: 'neutral', note: 'No cavas loaded yet' },
      { label: 'Inventory items', value: '0', tone: 'neutral', note: 'No inventory loaded yet' },
      { label: 'Fresh telemetry', value: '0', tone: 'neutral', note: 'No telemetry loaded yet' },
      { label: 'Latest sync', value: 'No data', tone: 'neutral', note: 'Waiting for the first refresh' },
    ];
  }
}
