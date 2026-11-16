import { SpaceType, SpacePlan, SpaceSubscriptionStatus, SpaceRole } from '../../../domain/model/valueobjects/space-access';

export interface SpaceResource {
  id: string;
  name: string;
  organization_id?: string | null;
  owner_user_id?: string | number | null;
  space_type?: SpaceType;
  subscription_plan?: SpacePlan;
  subscription_status?: SpaceSubscriptionStatus;
  role?: SpaceRole;
  created_at: string | null;
  updated_at: string | null;
}
