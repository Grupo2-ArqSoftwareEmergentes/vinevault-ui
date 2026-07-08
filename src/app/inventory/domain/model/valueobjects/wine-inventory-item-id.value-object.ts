export type WineInventoryItemId = Readonly<{ value: string }>;

export const createWineInventoryItemId = (value: string): WineInventoryItemId => {
  if (!value || value.trim().length === 0) {
    throw new Error('Wine inventory item id is required');
  }

  return Object.freeze({ value: value.trim() });
};
