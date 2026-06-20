export type WineCellarId = Readonly<{ value: string }>;

export const createWineCellarId = (value: string): WineCellarId => {
  if (!value || value.trim().length === 0) {
    throw new Error('Wine cellar id is required');
  }

  return Object.freeze({ value });
};
