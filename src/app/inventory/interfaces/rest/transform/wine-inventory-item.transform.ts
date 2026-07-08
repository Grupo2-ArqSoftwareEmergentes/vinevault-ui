import {
  WineInventoryItemCollectionResource,
  WineInventoryItemResource,
} from '../resources/wine-inventory-item.resource';
import { WineInventoryItem } from '../../../domain/services/wine-inventory-item-query-service';
import { createWineInventoryItemId } from '../../../domain/model/valueobjects/wine-inventory-item-id.value-object';
import { createWineCellarId } from '../../../../cava/domain/model/valueobjects/wine-cellar-id.value-object';

export const wineInventoryItemResourceToDomain = (resource: WineInventoryItemResource): WineInventoryItem => {
  return Object.freeze({
    id: createWineInventoryItemId(resource.id),
    wineCellarId: createWineCellarId(resource.wine_cellar_id),
    wineName: resource.wine_name,
    wineType: resource.wine_type,
    ageYears: resource.age_years,
    quantity: resource.quantity,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  });
};

export const wineInventoryItemsResourceToDomain = (
  resource: WineInventoryItemCollectionResource | null | undefined
): readonly WineInventoryItem[] => {
  if (!resource) return [];

  const items = Array.isArray(resource)
    ? resource
    : ((resource as {
        readonly items?: readonly WineInventoryItemResource[];
        readonly content?: readonly WineInventoryItemResource[];
        readonly data?: readonly WineInventoryItemResource[];
      }).items ??
        (resource as {
          readonly items?: readonly WineInventoryItemResource[];
          readonly content?: readonly WineInventoryItemResource[];
          readonly data?: readonly WineInventoryItemResource[];
        }).content ??
        (resource as {
          readonly items?: readonly WineInventoryItemResource[];
          readonly content?: readonly WineInventoryItemResource[];
          readonly data?: readonly WineInventoryItemResource[];
        }).data);
  if (!Array.isArray(items)) return [];

  return Object.freeze(items.map(wineInventoryItemResourceToDomain));
};
