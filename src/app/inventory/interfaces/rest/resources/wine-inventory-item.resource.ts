export interface WineInventoryItemResource {
  readonly id: string;
  readonly wine_cellar_id: string;
  readonly wine_name: string;
  readonly wine_type: string;
  readonly age_years: number;
  readonly quantity: number;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export type WineInventoryItemCollectionResource =
  | readonly WineInventoryItemResource[]
  | {
      readonly items?: readonly WineInventoryItemResource[];
      readonly content?: readonly WineInventoryItemResource[];
      readonly data?: readonly WineInventoryItemResource[];
    };
