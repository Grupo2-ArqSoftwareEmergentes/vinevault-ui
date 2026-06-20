import { SpaceId } from '../valueobjects/space-id.value-object';

export type GetSpaceByIdQuery = Readonly<{
  spaceId: SpaceId;
}>;

export const createGetSpaceByIdQuery = (
  spaceId: SpaceId
): GetSpaceByIdQuery => {
  return Object.freeze({ spaceId });
};
