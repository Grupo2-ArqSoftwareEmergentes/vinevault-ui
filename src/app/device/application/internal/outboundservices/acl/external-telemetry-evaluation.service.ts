import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_CONFIG } from '../../../../../api.config';

export type DeviceTelemetrySnapshot = Readonly<{
  connectivityStatus: string | null;
  connectivitySignalStrength: number | null;
  temperature: number | null;
  humidity: number | null;
  uptime: number;
  healthStatus: number;
  lastUpdateMinutes: number | null;
  network: string | null;
  location: string | null;
  occurredAt: string | null;
}>;

type DeviceTelemetrySummaryResource = Readonly<{
  device_id: string;
  assignment_id: string | null;
  space_id: string | null;
  source: string;
  payload: DeviceTelemetryPayloadResource | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}>;

type DeviceTelemetryPayloadResource = Readonly<{
  connectivity_status: string | null;
  signal_strength: number | null;
  temperature: number | null;
  humidity: number | null;
  uptime_seconds: number | null;
  health_status: number | null;
  wifi_status: string | null;
  network_name: string | null;
  country: string | null;
  recorded_at: string | null;
  occurred_at: string | null;
  device_time: string | null;
}>;

@Injectable({ providedIn: "root" })
export class ExternalTelemetryEvaluationService {
  private readonly telemetryUrl = API_CONFIG.baseUrl + API_CONFIG.endpoints.devices;

  constructor(private readonly http: HttpClient) {}

  fetchLatestTelemetryByDevice(deviceId: string): Observable<DeviceTelemetrySnapshot | null> {
    const params = new HttpParams().set('limit', '1');

    return this.http
      .get<readonly DeviceTelemetrySummaryResource[]>(`${this.telemetryUrl}/${deviceId}/telemetry`, { params })
      .pipe(
        map((records) => {
          const summary = records[0];
          const payload = summary?.payload ?? null;
          if (!summary || !payload) return null;

          return {
            connectivityStatus: payload.wifi_status ?? payload.connectivity_status ?? null,
            connectivitySignalStrength: payload.signal_strength,
            temperature: this.normalizeNumber(payload.temperature),
            humidity: this.normalizeNumber(payload.humidity),
            uptime: payload.uptime_seconds ?? 0,
            healthStatus: payload.health_status ?? 0,
            lastUpdateMinutes: this.computeMinutesSince(payload.occurred_at ?? payload.recorded_at ?? summary.occurred_at),
            network: payload.network_name,
            location: payload.country,
            occurredAt: payload.occurred_at ?? payload.recorded_at ?? summary.occurred_at,
          };
        }),
        catchError(() => of(null))
      );
  }

  private computeMinutesSince(recordedAt: string | null): number | null {
    if (!recordedAt) return null;
    try {
      const recorded = new Date(recordedAt);
      const now = new Date();
      const diffMs = now.getTime() - recorded.getTime();
      if (diffMs < 0) return 0;
      return Math.floor(diffMs / 60000);
    } catch {
      return null;
    }
  }

  private normalizeNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
