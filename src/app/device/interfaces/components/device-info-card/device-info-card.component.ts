import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatMenuModule } from "@angular/material/menu";
import { MatCardModule } from "@angular/material/card";
import { ClairDeviceComponent } from "../../components/icons/clair-device/clair-device.component";
import { Device } from "../../../domain/services/device-query-service";
import { DeviceTelemetrySnapshot } from "../../../application/internal/outboundservices/acl/external-telemetry-evaluation.service";
import { resolveDeviceConnectivityColor } from "../../rest/transform/device-connectivity-color.transform";

@Component({
  selector: "app-device-info-card",
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatCardModule,
    ClairDeviceComponent,
  ],
  templateUrl: "./device-info-card.component.html",
  styleUrl: "./device-info-card.component.css",
})
export class DeviceInfoCardComponent {
  @Input() device!: Device;
  @Input() telemetry: DeviceTelemetrySnapshot | null = null;
  @Output() backRequested = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<void>();
  @Output() deleteRequested = new EventEmitter<void>();
  @Output() powerToggleRequested = new EventEmitter<void>();

  goBack(): void {
    this.backRequested.emit();
  }

  togglePower(): void {
    this.powerToggleRequested.emit();
  }

  editDevice(): void {
    this.editRequested.emit();
  }

  deleteDevice(): void {
    this.deleteRequested.emit();
  }

  getStatusColor(): string {
    switch (this.device.status) {
      case "ONLINE":
        return "#10b981";
      case "STANDBY":
        return "#6b7280";
      case "OFFLINE":
        return "#6b7280";
      case "MAINTENANCE":
        return "#f59e0b";
      case "ERROR":
        return "#ef4444";
      case "DECOMMISSIONED":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  }

  getPowerButtonVariant(): "on" | "off" {
    return this.isDeviceLikelyAwake() ? "on" : "off";
  }

  getConnectivityColor(): string {
    return resolveDeviceConnectivityColor(this.telemetry);
  }

  getConnectivityValue(): number | null {
    if (this.telemetry?.connectivitySignalStrength != null) {
      return this.telemetry.connectivitySignalStrength;
    }
    return null;
  }

  formatUptime(): string {
    const seconds = this.telemetry?.uptime;
    if (seconds == null) return "--";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  private isDeviceLikelyAwake(): boolean {
    return this.device.status === "ONLINE";
  }
}
