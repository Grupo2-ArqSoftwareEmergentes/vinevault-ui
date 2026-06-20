export interface WineCellarResource {
  readonly id: string;
  readonly space_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly temperature_min: number;
  readonly temperature_max: number;
  readonly humidity_min: number;
  readonly humidity_max: number;
  readonly device_id: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export type WineCellarCollectionResource =
  | WineCellarResource[]
  | { items?: WineCellarResource[]; content?: WineCellarResource[]; data?: WineCellarResource[] };
