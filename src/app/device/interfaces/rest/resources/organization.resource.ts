export interface OrganizationResource {
  id: string;
  name: string;
  owner_user_id: string | number;
  created_at: string | null;
  updated_at: string | null;
}
