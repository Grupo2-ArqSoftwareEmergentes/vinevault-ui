import { SpaceId } from '../valueobjects/space-id.value-object';

export type GetDevicesBySpaceQuery = Readonly<{
  spaceId: SpaceId;
  page: number;
  size: number;
}>;

export const createGetDevicesBySpaceQuery = (
  spaceId: SpaceId,
  page: number,
  size: number
): GetDevicesBySpaceQuery => {
  if (page < 0) {
    throw new Error('Page must be non-negative');
  }
  if (size < 1) {
    throw new Error('Size must be at least 1');
  }
  return Object.freeze({ spaceId, page, size });
};
