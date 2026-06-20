import { CreateOrganizationCommand } from '../../../domain/model/commands/create-organization.command';
import { CreateOrganizationResource } from '../resources/create-organization.resource';

export const createOrganizationCommandToResource = (
  command: CreateOrganizationCommand
): CreateOrganizationResource => {
  return {
    name: command.name,
  };
};
