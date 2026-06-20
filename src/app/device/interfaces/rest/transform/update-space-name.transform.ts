import { UpdateSpaceNameCommand } from '../../../domain/model/commands/update-space-name.command';
import { UpdateSpaceNameResource } from '../resources/update-space-name.resource';

export const updateSpaceNameCommandToResource = (
  command: UpdateSpaceNameCommand
): UpdateSpaceNameResource => {
  return {
    name: command.name,
  };
};
