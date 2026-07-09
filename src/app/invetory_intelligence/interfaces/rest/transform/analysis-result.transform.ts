import { AnalysisResultResource } from '../resources/analysis-result.resource';
import { AnalysisResult } from '../../../domain/model/entities/analysis-result.model';

export function analysisResultResourceToDomain(resource: AnalysisResultResource): AnalysisResult {
  return {
    id: resource.id,
    analysisType: resource.analysis_type,
    content: resource.content,
    wineCellarId: resource.wine_cellar_id,
    tokensUsed: resource.tokens_used,
    createdAt: resource.created_at,
  };
}
