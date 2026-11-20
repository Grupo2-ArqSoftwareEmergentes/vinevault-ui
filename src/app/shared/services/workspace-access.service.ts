import { Injectable, computed, inject } from '@angular/core';
import { WorkspaceScopeService } from './workspace-scope.service';
import { hasSpacePermission, SpacePermission } from '../../device/domain/model/valueobjects/space-access';
import { canCreateCellar } from './workspace-quota';
import { SubscriptionApiService } from './subscription-api.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceAccessService {
  private readonly subscriptions = inject(SubscriptionApiService);
  readonly space = inject(WorkspaceScopeService).space;
  readonly overviewSpace = computed(() => {
    const spaceId = this.space()?.id.value;
    const overviewSpace = this.subscriptions.overview()?.space;
    return spaceId && overviewSpace?.id === spaceId ? overviewSpace : null;
  });
  readonly plan = computed(() => this.overviewSpace()?.subscription_plan ?? this.space()?.subscriptionPlan ?? null);
  readonly status = computed(() => this.overviewSpace()?.subscription_status ?? this.space()?.subscriptionStatus ?? null);
  readonly role = computed(() => this.overviewSpace()?.role ?? this.space()?.role ?? null);
  readonly purpose = computed(() => this.overviewSpace()?.purpose ?? this.space()?.spaceType ?? null);
  readonly canConfigure = computed(() => this.can('CONFIGURE'));
  readonly canCreateCellar = computed(() => canCreateCellar(this.space()));
  readonly canInventory = computed(() => this.can('INVENTORY'));
  readonly canAnalyze = computed(() => this.overviewSpace()?.can_analyze ?? this.can('ANALYZE'));
  readonly canManage = computed(() => this.can('MANAGE'));
  readonly canManageSubscription = computed(() => this.overviewSpace()?.can_manage_subscription ?? this.can('MANAGE'));
  can(permission: SpacePermission): boolean { return hasSpacePermission(this.space(), permission); }
}
