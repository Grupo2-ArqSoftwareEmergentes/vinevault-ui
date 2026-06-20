export type SpaceId = Readonly<{ value: string }>;

export const createSpaceId = (id: string): SpaceId => {
  if (!id || id.trim().length === 0) {
    throw new Error('Space ID must not be empty');
  }
  return Object.freeze({ value: id.trim() });
};
