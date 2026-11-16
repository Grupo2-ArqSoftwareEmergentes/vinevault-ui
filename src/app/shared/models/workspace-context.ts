import { SpaceId } from '../../device/domain/model/valueobjects/space-id.value-object';
import { WineCellarId } from '../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { WineCellarResource } from '../../cava/interfaces/rest/resources/wine-cellar.resource';
import { SpaceAccess, SpaceType, SpacePlan, SpaceSubscriptionStatus, SpaceRole } from '../../device/domain/model/valueobjects/space-access';

// Context summaries intentionally do not invent organization, owner, or sensor data.
export type WorkspaceSpace = Readonly<{ id: SpaceId; name: string } & SpaceAccess>;
export interface ContextSpaceResource {
  id: string;
  name: string;
  space_type: SpaceType;
  subscription_plan: SpacePlan;
  subscription_status: SpaceSubscriptionStatus;
  role: SpaceRole;
}
export type WorkspaceCellar = Readonly<{ id: WineCellarId; name: string; spaceId: SpaceId }>;
export interface CreatedWorkspace {
  space: WorkspaceSpace;
  cellar: WorkspaceCellar;
}

export interface CreatedSpaceResource extends ContextSpaceResource {
  default_wine_cellar: WineCellarResource;
}
export type WorkspaceDirectory = Readonly<{
  spaces: readonly WorkspaceSpace[];
  cellars: readonly WorkspaceCellar[];
}>;

export interface UserContextResource {
  spaces: ContextSpaceResource[];
  wine_cellars: { id: string; name: string; space_id: string }[];
}
