export interface AnalysisResultResource {
  readonly id: string;
  readonly analysis_type: string;
  readonly content: string;
  readonly wine_cellar_id: string;
  readonly tokens_used: number;
  readonly created_at: string;
}
