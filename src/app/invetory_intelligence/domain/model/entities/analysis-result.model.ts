export type AnalysisResult = Readonly<{
  id: string;
  analysisType: string;
  content: string;
  wineCellarId: string;
  tokensUsed: number;
  createdAt: string;
}>;
