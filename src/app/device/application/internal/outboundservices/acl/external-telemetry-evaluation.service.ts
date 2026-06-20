import { Injectable, Inject } from "@angular/core";
import { Observable, map } from "rxjs";
import {
  EvaluationContextFacade,
  LatestTelemetrySummary,
  EVALUATION_CONTEXT_FACADE,
} from "../../../../../evaluation/interfaces/acl/evaluation-context-facade";

export type DeviceTelemetrySnapshot = Readonly<{
  connectivityStatus: string | null;
  connectivitySignalStrength: number | null;
  uptime: number;
  healthStatus: number;
  lastUpdateMinutes: number | null;
  network: string | null;
  location: string | null;
}>;

@Injectable({ providedIn: "root" })
export class ExternalTelemetryEvaluationService {
  constructor(
    @Inject(EVALUATION_CONTEXT_FACADE)
    private readonly evaluationContextFacade: EvaluationContextFacade
  ) {}

  fetchLatestTelemetryByDevice(deviceId: string): Observable<DeviceTelemetrySnapshot | null> {
    return this.evaluationContextFacade.getLatestTelemetryByDevice(deviceId).pipe(
      map((summary: LatestTelemetrySummary | null) => {
        if (!summary) return null;
        return {
          connectivityStatus: summary.connectivityStatus,
          connectivitySignalStrength: summary.signalStrength,
          uptime: summary.uptime,
          healthStatus: summary.healthStatus,
          lastUpdateMinutes: this.computeMinutesSince(summary.recordedAt),
          network: summary.network,
          location: summary.locationCountry,
        };
      })
    );
  }

  private computeMinutesSince(recordedAt: string): number | null {
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
}
