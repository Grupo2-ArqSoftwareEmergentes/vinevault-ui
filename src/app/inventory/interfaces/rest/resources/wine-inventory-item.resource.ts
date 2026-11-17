import { WineDetailsResource } from './wine-details.resource';

export interface WineInventoryItemResource extends WineDetailsResource {
  readonly id: string;
  readonly wine_cellar_id: string;
  readonly name?: string | null;
  readonly wine_name?: string | null;
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
