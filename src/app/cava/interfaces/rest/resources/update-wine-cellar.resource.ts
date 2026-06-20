export interface UpdateWineCellarResource {
  readonly name: string;
  readonly description?: string | null;
  readonly temperature_min: number;
  readonly temperature_max: number;
  readonly humidity_min: number;
  readonly humidity_max: number;
}
