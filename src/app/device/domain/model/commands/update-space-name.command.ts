import { SpaceId } from '../valueobjects/space-id.value-object';

export type UpdateSpaceNameCommand = Readonly<{
  spaceId: SpaceId;
  name: string;
}>;

export const createUpdateSpaceNameCommand = (
  spaceId: SpaceId,
  name: string
): UpdateSpaceNameCommand => {
  if (!name || name.trim().length === 0) {
    throw new Error('Space name must not be empty');
  }
  return Object.freeze({ spaceId, name: name.trim() });
};
