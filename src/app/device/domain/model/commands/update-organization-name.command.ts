import { OrganizationId } from '../valueobjects/organization-id.value-object';

export type UpdateOrganizationNameCommand = Readonly<{
  organizationId: OrganizationId;
  name: string;
}>;

export const createUpdateOrganizationNameCommand = (
  organizationId: OrganizationId,
  name: string
): UpdateOrganizationNameCommand => {
  if (!name || name.trim().length === 0) {
    throw new Error('Organization name must not be empty');
  }
  return Object.freeze({ organizationId, name: name.trim() });
};
