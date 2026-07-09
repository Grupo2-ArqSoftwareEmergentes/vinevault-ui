import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { InventoryIntelligenceCommandService } from '../../../domain/services/inventory-intelligence-command-service';
import { AnalysisResult } from '../../../domain/model/entities/analysis-result.model';
import { API_CONFIG } from '../../../../api.config';
import { AnalysisResultResource } from '../../../interfaces/rest/resources/analysis-result.resource';
import { analysisResultResourceToDomain } from '../../../interfaces/rest/transform/analysis-result.transform';

@Injectable({
  providedIn: 'root',
})
export class InventoryIntelligenceCommandServiceImpl implements InventoryIntelligenceCommandService {
  private readonly http = inject(HttpClient);

  analyzeStock(wineCellarId: string): Observable<AnalysisResult> {
    const payload = { wine_cellar_id: wineCellarId };
    return this.http
      .post<AnalysisResultResource>(`${API_CONFIG.baseUrl}/api/v1/ai/analyze-stock`, payload)
      .pipe(map(analysisResultResourceToDomain));
  }
}
