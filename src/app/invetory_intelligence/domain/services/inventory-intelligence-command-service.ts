import { Observable } from 'rxjs';
import { AnalysisResult } from '../model/entities/analysis-result.model';
import { StockAnalysisEvent } from '../model/entities/stock-analysis-event.model';

export abstract class InventoryIntelligenceCommandService {
  abstract analyzeStock(wineCellarId: string): Observable<AnalysisResult>;
  abstract analyzeStockStream(wineCellarId: string): Observable<StockAnalysisEvent>;
}
export const INVENTORY_INTELLIGENCE_COMMAND_SERVICE = 'INVENTORY_INTELLIGENCE_COMMAND_SERVICE';
