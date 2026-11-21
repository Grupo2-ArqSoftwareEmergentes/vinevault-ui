export interface WineAiAutocompleteResponse {
  winery?: string | null;
  vintage?: string | null;
  country?: string | null;
  region?: string | null;
  denomination?: string | null;
  grape_type?: string | null;
  format?: string | null;
  aging?: string | null;
  alcohol?: string | null;
  drinking_window_start?: number | null;
  drinking_window_end?: number | null;
}
