import { Injectable, computed, inject } from '@angular/core';
import { WorkspaceScopeService } from './workspace-scope.service';
import { hasSpacePermission, SpacePermission } from '../../device/domain/model/valueobjects/space-access';
import { canCreateCellar } from './workspace-quota';
import { SubscriptionApiService } from './subscription-api.service';
import { PlanFeature } from '../models/subscription';

@Injectable({ providedIn: 'root' })
export class WorkspaceAccessService {
  private readonly subscriptions = inject(SubscriptionApiService);
  readonly space = inject(WorkspaceScopeService).space;
  readonly overviewSpace = computed(() => {
    const spaceId = this.space()?.id.value;
    const overviewSpace = this.subscriptions.scopedOverview()?.space;
    return spaceId && overviewSpace?.id === spaceId ? overviewSpace : null;
  });
  readonly plan = computed(() => this.overviewSpace()?.subscription_plan ?? this.space()?.subscriptionPlan ?? null);
  readonly status = computed(() => this.overviewSpace()?.subscription_status ?? this.space()?.subscriptionStatus ?? null);
  readonly role = computed(() => this.overviewSpace()?.role ?? this.space()?.role ?? null);
  readonly purpose = computed(() => this.overviewSpace()?.purpose ?? this.space()?.spaceType ?? null);
  readonly quotas = computed(() => this.overviewSpace()?.quotas ?? this.space()?.quotas);
  readonly effectiveSpace = computed(() => {
    const space = this.space();
    return space ? { ...space, quotas: this.quotas() } : null;
  });
  readonly capabilities = computed(() => {
    const overview = this.overviewSpace();
    return overview?.plan?.features ?? this.subscriptions.catalog()?.plans.find(plan =>
      plan.purpose === this.purpose() && plan.tier === this.plan())?.features ?? {};
  });
  readonly canConfigure = computed(() => this.can('CONFIGURE'));
  readonly canCreateCellar = computed(() => this.canConfigure() && canCreateCellar(this.effectiveSpace()));
  readonly canInventory = computed(() => this.can('INVENTORY'));
  readonly canAnalyze = computed(() => this.hasFeature('stock_analysis'));
  readonly canManage = computed(() => this.can('MANAGE'));
  readonly canManageSubscription = computed(() => this.can('MANAGE') && (this.overviewSpace()?.can_manage_subscription ?? true));
  hasFeature(feature: PlanFeature): boolean {
    const permission = feature === 'autocomplete' ? 'INVENTORY' : feature === 'excel_export' || feature === 'pdf_report' ? 'READ' : 'ANALYZE';
    return this.capabilities()[feature] === true && this.can(permission);
  }
  can(permission: SpacePermission): boolean {
    return hasSpacePermission(this.space(), permission) && hasSpacePermission({ role: this.role() }, permission);
  }
}
