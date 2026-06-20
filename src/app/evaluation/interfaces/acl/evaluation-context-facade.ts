import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface LatestTelemetrySummary {
  readonly connectivityStatus: string | null;
  readonly signalStrength: number | null;
  readonly uptime: number;
  readonly healthStatus: number;
  readonly recordedAt: string;
  readonly network: string | null;
  readonly locationCountry: string | null;
}

export interface EvaluationContextFacade {
  getLatestTelemetryByDevice(deviceId: string): Observable<LatestTelemetrySummary | null>;
}

export const EVALUATION_CONTEXT_FACADE = new InjectionToken<EvaluationContextFacade>('EVALUATION_CONTEXT_FACADE');
