import { WineDetailsResource } from './wine-details.resource';

export interface CreateWineInventoryItemResource extends WineDetailsResource {
  readonly name: string;
  readonly quantity: number;
}

export type UpdateWineInventoryItemResource = Partial<CreateWineInventoryItemResource>;
