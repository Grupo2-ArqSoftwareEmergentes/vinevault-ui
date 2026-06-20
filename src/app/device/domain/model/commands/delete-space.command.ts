import { SpaceId } from '../valueobjects/space-id.value-object';

export type DeleteSpaceCommand = Readonly<{
  spaceId: SpaceId;
}>;

export const createDeleteSpaceCommand = (
  spaceId: SpaceId
): DeleteSpaceCommand => {
  return Object.freeze({ spaceId });
};
