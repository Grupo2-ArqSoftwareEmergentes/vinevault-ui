import { Observable } from 'rxjs';
import { AnalysisResult } from '../model/entities/analysis-result.model';

export abstract class InventoryIntelligenceCommandService {
  abstract analyzeStock(wineCellarId: string): Observable<AnalysisResult>;
}
export const INVENTORY_INTELLIGENCE_COMMAND_SERVICE = 'INVENTORY_INTELLIGENCE_COMMAND_SERVICE';
