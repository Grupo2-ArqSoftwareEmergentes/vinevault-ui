import { WineCellarCollectionResource, WineCellarResource } from '../resources/wine-cellar.resource';
import { WineCellar } from '../../../domain/services/wine-cellar-query-service';
import { createWineCellarId } from '../../../domain/model/valueobjects/wine-cellar-id.value-object';
import { createSpaceId } from '../../../../device/domain/model/valueobjects/space-id.value-object';
import { createDeviceId } from '../../../../device/domain/model/valueobjects/device-id.value-object';

export const wineCellarResourceToDomain = (resource: WineCellarResource): WineCellar => {
  return Object.freeze({
    id: createWineCellarId(resource.id),
    spaceId: createSpaceId(resource.space_id),
    name: resource.name,
    description: resource.description,
    deviceId: resource.device_id ? createDeviceId(resource.device_id) : null,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  });
};

export const wineCellarsResourceToDomain = (resource: WineCellarCollectionResource | null | undefined): readonly WineCellar[] => {
  if (!resource) return [];

  const items = Array.isArray(resource) ? resource : resource.items ?? resource.content ?? resource.data;
  if (!Array.isArray(items)) return [];

  return Object.freeze(items.map(wineCellarResourceToDomain));
};
