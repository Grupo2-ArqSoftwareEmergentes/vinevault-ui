import { OrganizationId } from '../valueobjects/organization-id.value-object';

export type CreateSpaceCommand = Readonly<{
  name: string;
  organizationId: OrganizationId;
}>;

export const createCreateSpaceCommand = (
  name: string,
  organizationId: OrganizationId
): CreateSpaceCommand => {
  if (!name || name.trim().length === 0) {
    throw new Error('Space name must not be empty');
  }
  return Object.freeze({ name: name.trim(), organizationId });
};
