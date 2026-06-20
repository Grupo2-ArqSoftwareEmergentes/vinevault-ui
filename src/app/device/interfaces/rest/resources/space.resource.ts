export interface SpaceResource {
  id: string;
  name: string;
  organization_id: string;
  owner_user_id: string | number;
  created_at: string | null;
  updated_at: string | null;
}
