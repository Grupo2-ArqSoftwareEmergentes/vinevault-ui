import { AnalysisResult } from './analysis-result.model';

export type StockAnalysisEvent =
  | Readonly<{ type: 'delta'; text: string }>
  | Readonly<{ type: 'done'; result: AnalysisResult }>
  | Readonly<{ type: 'empty'; message: string }>;

export class StockAnalysisError extends Error {
  constructor(message: string, readonly status?: number, readonly retryAfterAt: number | null = null, readonly code?: string) {
    super(message);
    this.name = 'StockAnalysisError';
  }
}
