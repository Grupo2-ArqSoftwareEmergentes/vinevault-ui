import { SpaceResource } from '../resources/space.resource';
import { Space } from '../../../domain/services/device-query-service';
import { createSpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { createOrganizationId } from '../../../domain/model/valueobjects/organization-id.value-object';
import { createUserId } from '../../../domain/model/valueobjects/user-id.value-object';

export const spaceResourceToDomain = (resource: SpaceResource): Space => {
  return Object.freeze({
    id: createSpaceId(resource.id),
    name: resource.name,
    organizationId: resource.organization_id ? createOrganizationId(resource.organization_id) : null,
    ownerUserId: resource.owner_user_id != null ? createUserId(resource.owner_user_id) : null,
    spaceType: resource.space_type ?? null,
    subscriptionPlan: resource.subscription_plan ?? null,
    subscriptionStatus: resource.subscription_status ?? null,
    role: resource.role ?? null,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  });
};
