export interface WineCellarResource {
  readonly id: string;
  readonly space_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly device_id: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export type WineCellarCollectionResource =
  | WineCellarResource[]
  | { items?: WineCellarResource[]; content?: WineCellarResource[]; data?: WineCellarResource[] };
