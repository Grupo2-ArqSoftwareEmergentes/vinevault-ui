import { Injectable, computed, inject } from '@angular/core';
import { WorkspaceScopeService } from './workspace-scope.service';
import { hasSpacePermission, SpacePermission } from '../../device/domain/model/valueobjects/space-access';

@Injectable({ providedIn: 'root' })
export class WorkspaceAccessService {
  readonly space = inject(WorkspaceScopeService).space;
  readonly plan = computed(() => this.space()?.subscriptionPlan ?? null);
  readonly status = computed(() => this.space()?.subscriptionStatus ?? null);
  readonly role = computed(() => this.space()?.role ?? null);
  readonly purpose = computed(() => this.space()?.spaceType ?? null);
  readonly canConfigure = computed(() => this.can('CONFIGURE'));
  readonly canInventory = computed(() => this.can('INVENTORY'));
  readonly canAnalyze = computed(() => this.can('ANALYZE'));
  readonly canManage = computed(() => this.can('MANAGE'));
  can(permission: SpacePermission): boolean { return hasSpacePermission(this.space(), permission); }
}
