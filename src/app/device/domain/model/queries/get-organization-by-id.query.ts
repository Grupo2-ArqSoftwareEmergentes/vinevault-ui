import { OrganizationId } from '../valueobjects/organization-id.value-object';

export type GetOrganizationByIdQuery = Readonly<{
  organizationId: OrganizationId;
}>;

export const createGetOrganizationByIdQuery = (
  organizationId: OrganizationId
): GetOrganizationByIdQuery => {
  return Object.freeze({ organizationId });
};
