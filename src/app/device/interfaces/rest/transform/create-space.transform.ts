import { CreateSpaceCommand } from '../../../domain/model/commands/create-space.command';
import { CreateSpaceResource } from '../resources/create-space.resource';

export const createSpaceCommandToResource = (
  command: CreateSpaceCommand
): CreateSpaceResource => {
  return {
    name: command.name,
  };
};
