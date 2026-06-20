import { OrganizationResource } from '../resources/organization.resource';
import { Organization } from '../../../domain/services/device-query-service';
import { createOrganizationId } from '../../../domain/model/valueobjects/organization-id.value-object';
import { createUserId } from '../../../domain/model/valueobjects/user-id.value-object';

export const organizationResourceToDomain = (resource: OrganizationResource): Organization => {
  return Object.freeze({
    id: createOrganizationId(resource.id),
    name: resource.name,
    ownerUserId: createUserId(resource.owner_user_id),
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  });
};
