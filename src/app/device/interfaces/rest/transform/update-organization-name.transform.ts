import { UpdateOrganizationNameCommand } from '../../../domain/model/commands/update-organization-name.command';
import { UpdateOrganizationNameResource } from '../resources/update-organization-name.resource';

export const updateOrganizationNameCommandToResource = (
  command: UpdateOrganizationNameCommand
): UpdateOrganizationNameResource => {
  return {
    name: command.name,
  };
};
