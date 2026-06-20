import { SpaceResource } from '../resources/space.resource';
import { Space } from '../../../domain/services/device-query-service';
import { createSpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { createOrganizationId } from '../../../domain/model/valueobjects/organization-id.value-object';
import { createUserId } from '../../../domain/model/valueobjects/user-id.value-object';

export const spaceResourceToDomain = (resource: SpaceResource): Space => {
  return Object.freeze({
    id: createSpaceId(resource.id),
    name: resource.name,
    organizationId: createOrganizationId(resource.organization_id),
    ownerUserId: createUserId(resource.owner_user_id),
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  });
};
