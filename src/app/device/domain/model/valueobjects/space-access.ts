export type SpaceType = 'COLLECTOR' | 'BUSINESS';
export type SpacePlan = 'FREE' | 'PRO';
export type SpaceSubscriptionStatus = 'ACTIVE' | 'EXPIRED';
export type SpaceRole = 'OWNER' | 'SOMMELIER' | 'INVENTORY_CLERK' | 'WAITER';
export type SpacePermission = 'READ' | 'CONFIGURE' | 'INVENTORY' | 'ANALYZE' | 'MANAGE';
export interface SpaceAccess {
  // Legacy summaries may omit metadata. Missing/unknown roles must deny mutations.
  spaceType?: SpaceType | null;
  subscriptionPlan?: SpacePlan | null;
  subscriptionStatus?: SpaceSubscriptionStatus | null;
  role?: SpaceRole | null;
}
export function hasSpacePermission(space: SpaceAccess | null | undefined, permission: SpacePermission): boolean {
  const role = space?.role;
  if (!role) return false;
  if (permission === 'MANAGE') return role === 'OWNER';
  if (permission === 'CONFIGURE') return role === 'OWNER' || role === 'SOMMELIER';
  if (permission === 'READ') return ['OWNER', 'SOMMELIER', 'INVENTORY_CLERK', 'WAITER'].includes(role);
  return ['OWNER', 'SOMMELIER', 'INVENTORY_CLERK'].includes(role);
}
