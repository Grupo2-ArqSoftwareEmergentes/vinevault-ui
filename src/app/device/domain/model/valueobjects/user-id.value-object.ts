export type UserId = Readonly<{ value: string }>;

export const createUserId = (id: string | number): UserId => {
  const normalizedId = String(id).trim();
  if (normalizedId.length === 0) {
    throw new Error('User ID must not be empty');
  }
  return Object.freeze({ value: normalizedId });
};
