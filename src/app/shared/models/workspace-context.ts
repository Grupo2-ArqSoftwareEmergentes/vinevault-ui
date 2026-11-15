import { SpaceId } from '../../device/domain/model/valueobjects/space-id.value-object';
import { WineCellarId } from '../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { WineCellarResource } from '../../cava/interfaces/rest/resources/wine-cellar.resource';

// Context summaries intentionally do not invent organization, owner, or sensor data.
export type WorkspaceSpace = Readonly<{ id: SpaceId; name: string }>;
export type WorkspaceCellar = Readonly<{ id: WineCellarId; name: string; spaceId: SpaceId }>;
export interface CreatedWorkspace {
  space: WorkspaceSpace;
  cellar: WorkspaceCellar;
}

export interface CreatedSpaceResource {
  id: string;
  name: string;
  default_wine_cellar: WineCellarResource;
}
export type WorkspaceDirectory = Readonly<{
  spaces: readonly WorkspaceSpace[];
  cellars: readonly WorkspaceCellar[];
}>;

export interface UserContextResource {
  spaces: { id: string; name: string }[];
  wine_cellars: { id: string; name: string; space_id: string }[];
}
