export type CreateOrganizationCommand = Readonly<{
  name: string;
}>;

export const createCreateOrganizationCommand = (
  name: string
): CreateOrganizationCommand => {
  if (!name || name.trim().length === 0) {
    throw new Error('Organization name must not be empty');
  }
  return Object.freeze({ name: name.trim() });
};
