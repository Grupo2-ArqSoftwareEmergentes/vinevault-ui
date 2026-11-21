import { I18nModule } from '../../../../core/i18n/i18n.module';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, Subscription, catchError, distinctUntilChanged, finalize, forkJoin, map, of, switchMap, take } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { WorkspaceContextService, WorkspaceSelection } from '../../../../shared/services/workspace-context.service';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { inventoryQuotaProjection } from '../../../../shared/services/workspace-quota';
import { DEVICE_QUERY_SERVICE, Device } from '../../../../device/domain/services/device-query-service';
import { createGetDevicesBySpaceQuery } from '../../../../device/domain/model/queries/get-devices-by-space.query';
import { DeviceAlertQueryServiceImpl } from '../../../../alerts/application/internal/queryservices/device-alert-query-service.impl';
import { DeviceAlert } from '../../../../alerts/domain/services/device-alert-query-service';
import { createGetDeviceAlertsByDeviceQuery } from '../../../../alerts/domain/model/queries/get-device-alerts-by-device.query';
import { ExternalTelemetryEvaluationService, DeviceTelemetrySnapshot } from '../../../../device/application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';
import { WineInventoryItemQueryServiceImpl } from '../../../../inventory/application/internal/queryservices/wine-inventory-item-query-service.impl';
import { WineInventoryItem } from '../../../../inventory/domain/services/wine-inventory-item-query-service';
import { AssistantLauncherService } from '../../../../assistant/assistant-launcher.service';
import { inventoryCost } from './overview-inventory-cost';
import { I18nService, TranslationParams } from '../../../../core/i18n/i18n.service';

interface SummaryCard { label: string; value: string; icon: string; hint: string; route: string; }
interface ActivityItem { title: string; description: string; time: string; icon: string; sortAt: number; route: string; snapshot?: DeviceTelemetrySnapshot; titleKey?: string; descriptionKey?: string; params?: TranslationParams; context?: { spaceId: string; wineCellarId: string }; }
interface SensorReading { device: Device; snapshot: DeviceTelemetrySnapshot | null; alerts: readonly DeviceAlert[] | null; }

@Component({
  selector: 'app-overview', standalone: true,
  imports: [I18nModule, CommonModule, RouterLink, MatIconModule, MatProgressSpinnerModule, HeaderComponent, SidebarComponent],
  templateUrl: './overview.html', styleUrl: './overview.css', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview implements OnInit {
  readonly workspace = inject(WorkspaceContextService);
  readonly access = inject(WorkspaceAccessService);
  readonly assistant = inject(AssistantLauncherService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly devices = inject(DEVICE_QUERY_SERVICE);
  private readonly alerts = inject(DeviceAlertQueryServiceImpl);
  private readonly telemetry = inject(ExternalTelemetryEvaluationService);
  private readonly cellars = inject(WineCellarQueryServiceImpl);
  private readonly inventory = inject(WineInventoryItemQueryServiceImpl);
  private request?: Subscription;
  isSidebarOpen = window.innerWidth > 768;
  loading = false;
  error = '';
  refreshedAt: Date | null = null;
  summaryCards: readonly SummaryCard[] = this.cards(null, null, null, null);
  activityItems: readonly ActivityItem[] = [];
  costValue: string | null = null;
  costNote = 'Añade precios de compra para calcular el costo.';
  costKey = 'Añade precios de compra para calcular el costo.';
  costParams: TranslationParams = {};
  cellarState = 'Selecciona un espacio';
  cellarStateNote = 'Usa el selector de la barra superior para consultar tu operación.';
  stateTone: 'neutral' | 'warning' | 'success' = 'neutral';

  get contextParams() {
    const { space, cellar } = this.workspace.selection();
    return { spaceId: space?.id.value, wineCellarId: cellar?.id.value };
  }
  get scopeLabel(): string { return this.workspace.selection().cellar?.name ?? this.i18n.t('Todas las cavas del espacio'); }
  get refreshedLabel(): string { return this.refreshedAt ? `${this.i18n.t(this.cellarState === 'Datos parciales' ? 'Sincronización parcial' : 'Última sincronización')}: ${this.relativeTime(this.refreshedAt.toISOString())}` : this.i18n.t('Sin sincronizar'); }
  get canAddWine(): boolean {
    const { space, cellar } = this.workspace.selection();
    return !!cellar && this.access.canInventory() && !inventoryQuotaProjection(space, 0, 0, false)?.exceeded;
  }
  ngOnInit(): void {
    this.workspace.selectionChanges.pipe(
      distinctUntilChanged((a, b) => this.selectionKey(a) === this.selectionKey(b)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.loadOverview());
    this.workspace.ensureLoaded();
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }
  toggleSidebar(): void { this.isSidebarOpen = !this.isSidebarOpen; }
  closeSidebar(): void { this.isSidebarOpen = false; }
  refreshOverview(): void {
    if (this.loading) return;
    if (this.workspace.error() || !this.workspace.selection().space) this.workspace.refresh();
    else this.loadOverview();
  }
  addWine(): void {
    if (this.canAddWine) void this.router.navigate(['/inventory/new'], { queryParams: this.contextParams });
  }
  private selectionKey(selection: WorkspaceSelection): string {
    return [selection.space?.id.value, selection.cellar?.id.value, selection.space?.role, selection.space?.spaceType, selection.space?.subscriptionPlan, selection.space?.subscriptionStatus].join(':');
  }

  private loadOverview(): void {
    this.request?.unsubscribe();
    this.summaryCards = this.cards(null, null, null, null);
    this.activityItems = [];
    this.costValue = null;
    this.costNote = 'Añade precios de compra para calcular el costo.';
    this.costKey = this.costNote;
    this.costParams = {};
    this.refreshedAt = null;
    this.error = '';
    this.stateTone = 'neutral';
    const selection = this.workspace.selection();
    const { space, cellar } = selection;
    if (!space || !this.access.can('READ')) {
      this.cellarState = space ? 'Acceso no disponible' : 'Selecciona un espacio';
      this.cellarStateNote = space ? 'No tienes permisos de lectura en este espacio.' : 'Usa el selector de la barra superior para consultar tu operación.';
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cellarState = 'Actualizando el resumen';
    this.cellarStateNote = 'Consultando inventario y monitorización del contexto activo.';
    const key = this.selectionKey(selection);
    const issues = new Set<string>();
    const safe = <T>(source: Observable<T>, label: string): Observable<T | null> => source.pipe(
      catchError(() => { issues.add(label); return of(null); }),
    );
    this.request = forkJoin({
      cellars: safe(this.cellars.getWineCellarsBySpace(space.id.value), 'cavas'),
      devices: safe(this.fetchDevices(space.id), 'sensores'),
    }).pipe(
      switchMap(result => {
        const scopedCellars = result.cellars?.filter(item => item.spaceId.value === space.id.value) ?? null;
        const selectedDetail = scopedCellars?.find(item => item.id.value === cellar?.id.value);
        const scopedDevices = result.devices === null || (cellar && !selectedDetail) ? null
          : result.devices.filter(device => (!device.spaceId || device.spaceId.value === space.id.value) && (!cellar || device.id.value === selectedDetail?.deviceId?.value));
        const ids = cellar ? [cellar.id.value] : scopedCellars?.map(item => item.id.value);
        return forkJoin({
          inventory: ids ? this.inventoryFor(ids, source => safe(source, 'inventario')) : of(null),
          sensors: scopedDevices ? this.sensorReadings(scopedDevices, source => safe(source, 'alertas')) : of(null),
        });
      }),
      take(1), finalize(() => { this.loading = false; this.cdr.markForCheck(); }), takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ inventory, sensors }) => {
      if (this.selectionKey(this.workspace.selection()) !== key) return;
      const lowStock = inventory?.filter(item => space.spaceType === 'BUSINESS' && item.minStockAlert != null && item.quantity <= item.minStockAlert) ?? [];
      const activeAlerts = sensors?.flatMap(reading => reading.alerts?.filter(alert => alert.status.toUpperCase() === 'ACTIVE' && (!alert.spaceId || alert.spaceId.value === space.id.value)).map(alert => ({ device: reading.device, alert })) ?? []) ?? [];
      const alertsKnown = sensors !== null && sensors.every(reading => reading.alerts !== null) && (space.spaceType !== 'BUSINESS' || inventory !== null);
      const liveSensors = sensors?.filter(reading => reading.device.status === 'ONLINE' && this.fresh(reading.snapshot?.occurredAt)).length ?? null;
      this.summaryCards = this.cards(inventory?.reduce((sum, item) => sum + item.quantity, 0) ?? null, inventory?.length ?? null, alertsKnown ? activeAlerts.length + lowStock.length : null, liveSensors);
      const cost = inventoryCost(inventory ?? []);
      this.costValue = cost.value;
      this.costNote = inventory === null ? 'No pudimos consultar el costo del inventario.' : cost.missingPrices && cost.value !== null
        ? `Costo parcial: ${cost.missingPrices} referencias con stock no tienen precio de compra.`
        : cost.value !== null ? `${space.spaceType === 'BUSINESS' ? 'Costo unitario' : 'Precio pagado'} × botellas en stock. Moneda según tus registros.` : 'Añade precios de compra para calcular el costo.';
      this.costKey = inventory === null ? 'No pudimos consultar el costo del inventario.' : cost.missingPrices && cost.value !== null
        ? 'Costo parcial: {count} referencias con stock no tienen precio de compra.' : cost.value !== null ? '{label} × botellas en stock. Moneda según tus registros.' : 'Añade precios de compra para calcular el costo.';
      this.costParams = { count: cost.missingPrices, label: space.spaceType === 'BUSINESS' ? 'Costo unitario' : 'Precio pagado' };
      this.activityItems = [
        ...activeAlerts.map(({ device, alert }) => ({ title: `Alerta · ${device.name}`, titleKey: 'Alerta · {name}', params: { name: device.name }, descriptionKey: alert.message ? undefined : alert.metric === 'HUMIDITY' ? 'Humedad fuera del umbral configurado.' : 'Temperatura fuera del umbral configurado.', description: alert.message || `${alert.metric === 'HUMIDITY' ? 'Humedad' : 'Temperatura'} fuera del umbral configurado.`, time: this.relativeTime(alert.occurredAt), icon: 'warning', sortAt: this.timestamp(alert.occurredAt), route: '/alerts' })),
        ...(sensors ?? []).flatMap(({ device, snapshot }) => snapshot?.occurredAt ? [{ title: `Lectura · ${device.name}`, titleKey: 'Lectura · {name}', params: { name: device.name }, snapshot, description: this.telemetryDescription(snapshot), time: this.relativeTime(snapshot.occurredAt), icon: 'sensors', sortAt: this.timestamp(snapshot.occurredAt), route: '/devices' }] : []),
        ...lowStock.map(item => ({ title: `Stock bajo · ${item.name}`, titleKey: 'Stock bajo · {name}', descriptionKey: '{count} botellas disponibles; mínimo configurado: {minimum}.', params: { name: item.name, count: item.quantity, minimum: item.minStockAlert }, description: `${item.quantity} botellas disponibles; mínimo configurado: ${item.minStockAlert}.`, time: 'Stock actual', icon: 'inventory_2', sortAt: this.timestamp(item.updatedAt), route: '/inventory', context: { spaceId: space.id.value, wineCellarId: item.wineCellarId.value } })),
      ].sort((a, b) => b.sortAt - a.sortAt).slice(0, 6);
      this.error = issues.size ? `No pudimos actualizar: ${[...issues].join(', ')}. Puedes volver a sincronizar.` : '';
      this.setCellarState(inventory, sensors, activeAlerts.length + lowStock.length, !!issues.size);
      this.refreshedAt = new Date();
      this.cdr.markForCheck();
    });
  }

  private fetchDevices(spaceId: { readonly value: string }): Observable<readonly Device[]> {
    return this.devices.handleGetDevicesBySpace(createGetDevicesBySpaceQuery(spaceId, 0, 100)).pipe(switchMap(first => {
      const remaining = Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => i + 1);
      return remaining.length ? forkJoin(remaining.map(page => this.devices.handleGetDevicesBySpace(createGetDevicesBySpaceQuery(spaceId, page, 100)))).pipe(map(pages => [first, ...pages].flatMap(page => page.content))) : of(first.content);
    }));
  }
  private inventoryFor(ids: readonly string[], safe: (source: Observable<readonly WineInventoryItem[]>) => Observable<readonly WineInventoryItem[] | null>): Observable<readonly WineInventoryItem[] | null> {
    return ids.length ? forkJoin(ids.map(id => safe(this.inventory.getInventoryItemsByWineCellar(id)).pipe(map(items => items?.filter(item => item.wineCellarId.value === id) ?? null)))).pipe(map(groups => groups.some(group => group === null) ? null : groups.flatMap(group => group ?? []))) : of([]);
  }
  private sensorReadings(devices: readonly Device[], safe: (source: Observable<readonly DeviceAlert[]>) => Observable<readonly DeviceAlert[] | null>): Observable<readonly SensorReading[]> {
    return devices.length ? forkJoin(devices.map(device => forkJoin({ snapshot: this.telemetry.fetchLatestTelemetryByDevice(device.id.value).pipe(catchError(() => of(null))), alerts: safe(this.alerts.handleGetDeviceAlertsByDevice(createGetDeviceAlertsByDeviceQuery(device.id, true))) }).pipe(map(result => ({ device, ...result }))))) : of([]);
  }
  private cards(bottles: number | null, skus: number | null, alerts: number | null, sensors: number | null): readonly SummaryCard[] {
    const count = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('es-PE').format(value);
    return [
      { label: 'Botellas en stock', value: count(bottles), icon: 'wine_bar', hint: 'Disponibles en el ámbito seleccionado', route: '/inventory' },
      { label: 'Referencias / SKUs', value: count(skus), icon: 'inventory_2', hint: 'Referencias registradas, también con stock cero', route: '/inventory' },
      { label: 'Alertas activas', value: count(alerts), icon: 'notifications_active', hint: 'Incidencias ambientales y de stock sin resolver', route: '/alerts' },
      { label: 'Sensores en línea', value: count(sensors), icon: 'sensors', hint: 'Con lecturas en los últimos 15 minutos', route: '/devices' },
    ];
  }
  private setCellarState(inventory: readonly WineInventoryItem[] | null, sensors: readonly SensorReading[] | null, alerts: number, partial: boolean): void {
    this.stateTone = 'neutral';
    if (partial || inventory === null || sensors === null) { this.cellarState = 'Datos parciales'; this.cellarStateNote = 'Revisa las fuentes pendientes antes de evaluar el estado general.'; }
    else if (alerts) { this.cellarState = 'Requiere atención'; this.cellarStateNote = 'Revisa las alertas y las referencias con stock bajo.'; this.stateTone = 'warning'; }
    else if (!inventory.length) { this.cellarState = 'Inventario por completar'; this.cellarStateNote = 'Añade tu primer vino para empezar a gestionar esta cava.'; }
    else if (!sensors.length) { this.cellarState = 'Sin monitorización vinculada'; this.cellarStateNote = 'Vincula un sensor para seguir las condiciones de conservación.'; }
    else if (sensors.some(reading => reading.device.status !== 'ONLINE' || !this.fresh(reading.snapshot?.occurredAt))) { this.cellarState = 'Revisar monitorización'; this.cellarStateNote = 'Hay sensores sin conexión o sin lecturas recientes.'; this.stateTone = 'warning'; }
    else { this.cellarState = 'Sin incidencias detectadas'; this.cellarStateNote = 'El inventario y las condiciones monitorizadas no presentan avisos activos.'; this.stateTone = 'success'; }
  }
  private timestamp(value: string | null | undefined): number { return value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0; }
  private fresh(value: string | null | undefined): boolean { const timestamp = this.timestamp(value); return timestamp > 0 && Date.now() - timestamp >= -60_000 && Date.now() - timestamp <= 15 * 60_000; }
  relativeTime(value: string | number): string {
    if (typeof value === 'number') value = value ? new Date(value).toISOString() : '';
    const timestamp = this.timestamp(value);
    if (!timestamp) return this.i18n.t('Sin fecha');
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
    return minutes < 1 ? this.i18n.t('ahora') : minutes < 60 ? this.i18n.t('hace {count} min', { count: minutes }) : minutes < 1440 ? this.i18n.t('hace {count} h', { count: Math.floor(minutes / 60) }) : this.i18n.date(timestamp);
  }
  telemetryDescription(snapshot: DeviceTelemetrySnapshot): string {
    return [snapshot.temperature != null ? `${snapshot.temperature.toFixed(1)} °C` : this.i18n.t('Temperatura sin lectura'), snapshot.humidity != null ? `${snapshot.humidity.toFixed(1)} ${this.i18n.t('% de humedad')}` : this.i18n.t('Humedad sin lectura')].join(' · ');
  }
}
