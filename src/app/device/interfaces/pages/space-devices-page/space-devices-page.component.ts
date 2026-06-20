import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { OrganizationsPanelComponent } from '../../components/organizations-panel/organizations-panel.component';
import { DeviceDetailPanelComponent } from '../../components/device-detail-panel/device-detail-panel.component';
import { DeviceListComponent, DeviceViewMode } from '../../components/device-list/device-list.component';
import { SpaceDetailHeaderComponent } from '../../components/space-detail-header/space-detail-header.component';
import { Device, DevicePage, Space } from '../../../domain/services/device-query-service';
import { SpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { DeviceTelemetrySnapshot } from '../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service';
import { DeviceThreshold } from '../../../domain/services/device-threshold-query-service';
import { SpaceDevicesNavigationStateService } from './space-devices-navigation-state.service';
import { SpaceDevicesSelectionHydrationService } from './space-devices-selection-hydration.service';
import { SpaceDevicesPageActionsService } from './space-devices-page-actions.service';

@Component({
  selector: 'app-space-devices-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    SidebarComponent,
    HeaderComponent,
    OrganizationsPanelComponent,
    DeviceDetailPanelComponent,
    SpaceDetailHeaderComponent,
    DeviceListComponent,
  ],
  templateUrl: './space-devices-page.component.html',
  styleUrl: './space-devices-page.component.css',
})
export class SpaceDevicesPageComponent implements OnInit, OnDestroy {
  private readonly navigationState = inject(SpaceDevicesNavigationStateService);
  private readonly selectionHydration = inject(SpaceDevicesSelectionHydrationService);
  private readonly pageActions = inject(SpaceDevicesPageActionsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(OrganizationsPanelComponent) orgPanel!: OrganizationsPanelComponent;

  private readonly subscriptions = new Subscription();
  private telemetryPollingSubscription: Subscription | null = null;
  private listTelemetryPollingSubscription: Subscription | null = null;
  private statusPollingSubscription: Subscription | null = null;
  private statusPollingResetTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private trackedStatusDeviceId: string | null = null;

  isSidebarOpen = true;
  isOrganizationsDrawerOpen = false;
  selectedSpace: Space | null = null;
  selectedDevice: Device | null = null;
  devicesPage: DevicePage | null = null;
  viewMode: DeviceViewMode = 'grid';
  loadingDevices = false;
  errorDevices = '';
  latestTelemetry: DeviceTelemetrySnapshot | null = null;
  deviceTelemetryByDeviceId: Record<string, DeviceTelemetrySnapshot | null> = {};
  selectedDeviceThresholds: readonly DeviceThreshold[] | null = null;

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        const selectionFromUrl = this.navigationState.readSelectionFromQueryParams(params);
        const deviceId = selectionFromUrl?.deviceId ?? null;
        const spaceId = selectionFromUrl?.spaceId ?? null;

        const currentDeviceId = this.selectedDevice?.id.value ?? null;
        const currentSpaceId = this.selectedSpace?.id.value ?? null;
        if (deviceId === currentDeviceId && spaceId === currentSpaceId) return;

        if (deviceId) {
          this.hydrateFromDeviceId(deviceId);
          return;
        }

        if (spaceId) {
          this.hydrateFromSpaceId(spaceId);
          return;
        }

        this.hydrateFromLastSelection();
      })
    );
  }

  ngOnDestroy(): void {
    this.stopTelemetryPolling();
    this.stopListTelemetryPolling();
    this.stopStatusPolling();
    this.subscriptions.unsubscribe();
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
    this.selectedDevice = null;
    this.latestTelemetry = null;
    this.deviceTelemetryByDeviceId = {};
    this.stopTelemetryPolling();
    this.stopStatusPolling();
    this.loadDevices(space.id);
    this.navigationState.syncQueryParams(this.router, this.route, { spaceId: space.id.value, deviceId: null });
    this.navigationState.persistSelectionToLocalStorage({ spaceId: space.id.value, deviceId: null });
  }

  clearSelectedSpace(): void {
    this.selectedSpace = null;
    this.selectedDevice = null;
    this.latestTelemetry = null;
    this.deviceTelemetryByDeviceId = {};
    this.stopTelemetryPolling();
    this.stopListTelemetryPolling();
    this.stopStatusPolling();
    this.devicesPage = null;
    this.errorDevices = '';
    this.navigationState.syncQueryParams(this.router, this.route, { spaceId: null, deviceId: null });
    this.navigationState.clearLocalStorageSelection();
  }

  setViewMode(mode: DeviceViewMode): void {
    this.viewMode = mode;
  }

  selectDevice(device: Device): void {
    this.selectedDevice = device;
    this.selectedDeviceThresholds = device.thresholds;
    this.stopListTelemetryPolling();
    this.startTelemetryPolling(device.id.value);
    this.startStatusPolling(device.id.value, 10_000);
    this.navigationState.syncQueryParams(this.router, this.route, { spaceId: this.selectedSpace?.id.value ?? null, deviceId: device.id.value });
    this.navigationState.persistSelectionToLocalStorage({ spaceId: this.selectedSpace?.id.value ?? null, deviceId: device.id.value });
  }

  clearSelectedDevice(): void {
    this.selectedDevice = null;
    this.latestTelemetry = null;
    this.selectedDeviceThresholds = null;
    this.stopTelemetryPolling();
    if (this.devicesPage) this.startListTelemetryPolling(this.devicesPage.content);
    this.navigationState.syncQueryParams(this.router, this.route, { spaceId: this.selectedSpace?.id.value ?? null, deviceId: null });
    this.navigationState.persistSelectionToLocalStorage({ spaceId: this.selectedSpace?.id.value ?? null, deviceId: null });
  }

  private hydrateFromDeviceId(deviceId: string): void {
    this.subscriptions.add(
      this.selectionHydration.hydrateFromDeviceId(deviceId).subscribe((result) => {
        if (!result) return;
        const { device, space } = result;

        this.selectedDevice = device;
        this.latestTelemetry = null;
        this.selectedDeviceThresholds = null;

        if (space) this.applyHydratedSpace(space);
        else {
          this.selectedSpace = null;
          this.devicesPage = null;
          this.errorDevices = '';
          this.cdr.markForCheck();
        }

        if (device.spaceId) this.loadDevices(device.spaceId);
        this.selectedDeviceThresholds = device.thresholds;
        this.startTelemetryPolling(device.id.value);
        this.startStatusPolling(device.id.value, 10_000);

        this.navigationState.syncQueryParams(this.router, this.route, {
          spaceId: device.spaceId ? device.spaceId.value : null,
          deviceId: device.id.value,
        }, true);

        this.navigationState.persistSelectionToLocalStorage({
          spaceId: device.spaceId ? device.spaceId.value : null,
          deviceId: device.id.value,
        });
      })
    );
  }

  private hydrateFromSpaceId(spaceId: string): void {
    this.subscriptions.add(
      this.selectionHydration.hydrateFromSpaceId(spaceId).subscribe((space) => {
        if (!space) return;
        this.selectedDevice = null;
        this.latestTelemetry = null;
        this.selectedDeviceThresholds = null;
        this.applyHydratedSpace(space);
        this.loadDevices(space.id);
        this.stopStatusPolling();
        this.navigationState.persistSelectionToLocalStorage({ spaceId: space.id.value, deviceId: null });
      })
    );
  }

  private applyHydratedSpace(space: Space): void {
    this.selectedSpace = space;
    this.devicesPage = null;
    this.errorDevices = '';
    this.cdr.markForCheck();

    if (this.orgPanel) {
      this.orgPanel.ensureOrganizationExpanded(space.organizationId);
    }
  }

  onEditThresholdsRequested(): void {
    if (!this.selectedDevice) return;
    const deviceId = this.selectedDevice.id.value;
    this.subscriptions.add(
      this.pageActions.runEditDeviceThresholdsFlow(deviceId).subscribe((changed) => {
        if (!changed) return;
        setTimeout(() => this.loadThresholds(deviceId));
      })
    );
  }

  private loadThresholds(deviceId: string): void {
    this.selectedDeviceThresholds = null;
    this.subscriptions.add(
      this.pageActions.loadDeviceThresholds(deviceId).subscribe({
        next: (thresholds) => {
          if (this.selectedDevice?.id.value !== deviceId) return;
          this.selectedDeviceThresholds = thresholds;
          this.cdr.markForCheck();
        },
        error: () => {
          if (this.selectedDevice?.id.value !== deviceId) return;
          this.selectedDeviceThresholds = [];
          this.cdr.markForCheck();
        },
      })
    );
  }

  private hydrateFromLastSelection(): void {
    const selection = this.navigationState.readSelectionFromLocalStorage();
    if (!selection) return;

    this.navigationState.syncQueryParams(
      this.router,
      this.route,
      { spaceId: selection.spaceId, deviceId: selection.deviceId },
      true
    );
  }

  openClaimDeviceDialog(): void {
    if (!this.selectedSpace) return;
    this.subscriptions.add(
      this.pageActions.runClaimDeviceFlow(this.selectedSpace).subscribe({
        next: () => {
          if (this.selectedSpace) this.loadDevices(this.selectedSpace.id);
        },
      })
    );
  }

  openPairDeviceDialog(): void {
    this.subscriptions.add(
      this.pageActions.runPairDeviceFlow().subscribe({
        next: () => {},
      })
    );
  }

  openEditSpaceDialog(): void {
    if (!this.selectedSpace) return;
    const currentSpace = this.selectedSpace;
    this.subscriptions.add(
      this.pageActions.runEditSpaceNameFlow(currentSpace).subscribe((name) => {
        if (!name) return;
        if (this.selectedSpace && this.selectedSpace.id.value === currentSpace.id.value) {
          this.selectedSpace = { ...this.selectedSpace, name };
        }
        if (this.orgPanel) this.orgPanel.loadSpaces(currentSpace.organizationId);
      })
    );
  }

  openDeleteSpaceDialog(): void {
    if (!this.selectedSpace) return;
    const orgId = this.selectedSpace.organizationId;
    const spaceId = this.selectedSpace.id;
    this.subscriptions.add(
      this.pageActions.runDeleteSpaceFlow(spaceId).subscribe((deleted) => {
        if (!deleted) return;
        this.selectedSpace = null;
        this.selectedDevice = null;
        this.latestTelemetry = null;
        this.devicesPage = null;
        if (this.orgPanel) this.orgPanel.loadSpaces(orgId);
      })
    );
  }

  private loadDevices(spaceId: SpaceId): void {
    this.loadingDevices = true;
    this.errorDevices = '';
    this.devicesPage = null;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.pageActions.loadDevices(spaceId, 0, 50).subscribe({
        next: (page) => {
          this.devicesPage = page;
          this.loadingDevices = false;
          if (!this.selectedDevice) this.startListTelemetryPolling(page.content);
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorDevices = 'Failed to load devices';
          this.loadingDevices = false;
          this.stopListTelemetryPolling();
          this.cdr.markForCheck();
        },
      })
    );
  }

  openEditDeviceDialog(): void {
    if (!this.selectedDevice) return;
    const currentDevice = this.selectedDevice;
    this.subscriptions.add(
      this.pageActions.runEditDeviceNameFlow(currentDevice).subscribe((name) => {
        if (!name) return;
        if (this.selectedDevice && this.selectedDevice.id.value === currentDevice.id.value) {
          this.selectedDevice = { ...this.selectedDevice, name };
        }
        if (this.selectedSpace) this.loadDevices(this.selectedSpace.id);
      })
    );
  }

  openDeleteDeviceDialog(): void {
    if (!this.selectedDevice) return;
    const currentDevice = this.selectedDevice;
    this.subscriptions.add(
      this.pageActions.runDeleteDeviceFlow(currentDevice).subscribe((deleted) => {
        if (!deleted) return;
        this.selectedDevice = null;
        this.latestTelemetry = null;
        if (this.selectedSpace) this.loadDevices(this.selectedSpace.id);
      })
    );
  }

  toggleDevicePower(): void {
    if (!this.selectedDevice) return;
    const deviceId = this.selectedDevice.id.value;
    const intent: 'WAKE' | 'STANDBY' = this.selectedDevice.status === 'ONLINE' ? 'STANDBY' : 'WAKE';

    this.subscriptions.add(
      this.pageActions.runToggleDevicePowerFlow(this.selectedDevice, intent).subscribe({
        next: () => {
          this.startStatusPolling(deviceId, 2_000);
          if (this.statusPollingResetTimeoutId) clearTimeout(this.statusPollingResetTimeoutId);
          this.statusPollingResetTimeoutId = setTimeout(() => {
            if (this.trackedStatusDeviceId === deviceId) this.startStatusPolling(deviceId, 10_000);
          }, 60_000);
        },
      })
    );
  }

  private startTelemetryPolling(deviceId: string): void {
    this.stopTelemetryPolling();
    this.latestTelemetry = null;
    this.telemetryPollingSubscription = this.pageActions.watchLatestTelemetry(deviceId, 10_000).subscribe({
        next: (snapshot) => {
          this.latestTelemetry = snapshot;
          this.deviceTelemetryByDeviceId = { ...this.deviceTelemetryByDeviceId, [deviceId]: snapshot };
          this.cdr.markForCheck();
        },
        error: () => {
          this.latestTelemetry = null;
          this.deviceTelemetryByDeviceId = { ...this.deviceTelemetryByDeviceId, [deviceId]: null };
          this.cdr.markForCheck();
        },
      });
  }

  private stopTelemetryPolling(): void {
    if (!this.telemetryPollingSubscription) return;
    this.telemetryPollingSubscription.unsubscribe();
    this.telemetryPollingSubscription = null;
  }

  private startListTelemetryPolling(devices: readonly Device[]): void {
    this.stopListTelemetryPolling();
    if (devices.length === 0) {
      this.deviceTelemetryByDeviceId = {};
      return;
    }

    this.listTelemetryPollingSubscription = this.pageActions.watchLatestTelemetryByDevices(devices, 60_000).subscribe((telemetryByDeviceId) => {
      this.deviceTelemetryByDeviceId = { ...this.deviceTelemetryByDeviceId, ...telemetryByDeviceId };
      this.cdr.markForCheck();
    });
  }

  private stopListTelemetryPolling(): void {
    if (!this.listTelemetryPollingSubscription) return;
    this.listTelemetryPollingSubscription.unsubscribe();
    this.listTelemetryPollingSubscription = null;
  }

  private startStatusPolling(deviceId: string, refreshIntervalMs: number): void {
    this.stopStatusPolling();
    this.trackedStatusDeviceId = deviceId;
    this.statusPollingSubscription = this.pageActions.watchDeviceStatus(deviceId, refreshIntervalMs).subscribe((snapshot) => {
      if (!snapshot || this.trackedStatusDeviceId !== snapshot.deviceId.value) return;

      let selectedDeviceChanged = false;
      if (this.selectedDevice?.id.value === snapshot.deviceId.value) {
        const statusChanged = this.selectedDevice.status !== snapshot.status;
        const lastSeenChanged = this.selectedDevice.lastSeenAt !== snapshot.lastSeenAt;
        selectedDeviceChanged = statusChanged || lastSeenChanged;

        if (selectedDeviceChanged) {
          this.selectedDevice = { ...this.selectedDevice, status: snapshot.status, lastSeenAt: snapshot.lastSeenAt };
        }
      }

      let devicesPageChanged = false;
      if (this.devicesPage) {
        this.devicesPage = {
          ...this.devicesPage,
          content: this.devicesPage.content.map((device) => {
            if (device.id.value !== snapshot.deviceId.value) return device;
            const statusChanged = device.status !== snapshot.status;
            const lastSeenChanged = device.lastSeenAt !== snapshot.lastSeenAt;
            if (!statusChanged && !lastSeenChanged) return device;
            devicesPageChanged = true;
            return { ...device, status: snapshot.status, lastSeenAt: snapshot.lastSeenAt };
          }),
        };
      }

      if (!selectedDeviceChanged && !devicesPageChanged) return;
      this.cdr.markForCheck();
    });
  }

  private stopStatusPolling(): void {
    if (this.statusPollingResetTimeoutId) {
      clearTimeout(this.statusPollingResetTimeoutId);
      this.statusPollingResetTimeoutId = null;
    }
    if (!this.statusPollingSubscription) return;
    this.statusPollingSubscription.unsubscribe();
    this.statusPollingSubscription = null;
    this.trackedStatusDeviceId = null;
  }
}
