import { OrganizationId } from '../valueobjects/organization-id.value-object';

export type GetSpacesByOrganizationQuery = Readonly<{
  organizationId: OrganizationId;
}>;

export const createGetSpacesByOrganizationQuery = (
  organizationId: OrganizationId
): GetSpacesByOrganizationQuery => {
  return Object.freeze({ organizationId });
};
