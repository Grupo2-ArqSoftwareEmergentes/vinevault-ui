export type OrganizationId = Readonly<{ value: string }>;

export const createOrganizationId = (id: string): OrganizationId => {
  if (!id || id.trim().length === 0) {
    throw new Error('Organization ID must not be empty');
  }
  return Object.freeze({ value: id.trim() });
};
