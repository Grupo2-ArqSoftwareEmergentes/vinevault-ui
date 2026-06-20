import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { EvaluationContextFacade, LatestTelemetrySummary } from '../../interfaces/acl/evaluation-context-facade';

@Injectable({ providedIn: 'root' })
export class NoopEvaluationContextFacade implements EvaluationContextFacade {
  getLatestTelemetryByDevice(_deviceId: string): Observable<LatestTelemetrySummary | null> {
    return of(null);
  }
}
