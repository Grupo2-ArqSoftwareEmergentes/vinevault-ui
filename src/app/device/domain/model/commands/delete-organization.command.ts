import { OrganizationId } from '../valueobjects/organization-id.value-object';

export type DeleteOrganizationCommand = Readonly<{
  organizationId: OrganizationId;
}>;

export const createDeleteOrganizationCommand = (
  organizationId: OrganizationId
): DeleteOrganizationCommand => {
  return Object.freeze({ organizationId });
};
