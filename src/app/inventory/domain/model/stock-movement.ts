export type StockExitReason = 'sale' | 'tasting' | 'breakage' | 'uncorking';
export interface StockExitPayload {
  readonly quantity: number;
  readonly reason: StockExitReason;
  readonly notes?: string | null;
}
export interface StockMovement extends StockExitPayload {
  readonly id: string;
  readonly inventoryItemId: string;
  readonly userId: number;
  readonly stockBefore: number;
  readonly stockAfter: number;
  readonly createdAt: string | null;
}
