import { HttpErrorResponse } from '@angular/common/http';
import { AccountQuota, ResourceQuota, WorkspaceSpace } from '../models/workspace-context';
import { hasSpacePermission, SpaceType } from '../../device/domain/model/valueobjects/space-access';

export type QuotaErrorCode = 'SPACE_LIMIT_REACHED' | 'CELLAR_LIMIT_REACHED' | 'ITEM_LIMIT_REACHED';
const messages: Record<QuotaErrorCode, string> = {
  SPACE_LIMIT_REACHED: 'No hay cupo para otro espacio del tipo solicitado.',
  CELLAR_LIMIT_REACHED: 'Amplía el cupo de cavas o cambia de plan.',
  ITEM_LIMIT_REACHED: 'Reduce la cantidad, libera SKUs o cambia de plan.',
};
export function quotaErrorDetail(error: unknown): { code: QuotaErrorCode; message: string } | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return null;
  const detail = error.error?.detail;
  if (!detail || typeof detail !== 'object' || !Object.prototype.hasOwnProperty.call(messages, detail.code)) return null;
  const code = detail.code as QuotaErrorCode;
  return { code, message: typeof detail.message === 'string' && detail.message.trim() ? detail.message : messages[code] };
}

// Optional metadata supports older contexts; missing quotas never invent usage/limits.
// The server remains authoritative for both stale and missing metadata.
export function canCreateSpace(quota: AccountQuota | null | undefined, purpose: SpaceType): boolean {
  return (purpose === 'COLLECTOR' ? quota?.can_create_collector : quota?.can_create_business) ?? true;
}
export function quotaHasRoom(quota: ResourceQuota | undefined, count = 1): boolean {
  return !quota || quota.limit === null || (quota.remaining !== null ? quota.remaining >= count : quota.used + count <= quota.limit);
}
export function canCreateCellar(space: WorkspaceSpace | null | undefined): boolean {
  return hasSpacePermission(space, 'CONFIGURE') && quotaHasRoom(space?.quotas?.cellars);
}
export function inventoryQuotaProjection(space: WorkspaceSpace | null, quantity: number, previousQuantity: number, editing: boolean) {
  if (!space?.quotas) return null;
  const resource = space.spaceType === 'COLLECTOR' ? 'bottles' : space.spaceType === 'BUSINESS' ? 'skus' : null;
  if (!resource) return null;
  const quota = space.quotas[resource];
  const projected = resource === 'bottles' ? quota.used - (editing ? previousQuantity : 0) + quantity : quota.used + (editing ? 0 : 1);
  // Existing records may always be corrected/reduced even when already over quota.
  const exceeded = quota.limit !== null && projected > quota.limit && (!editing || projected > quota.used);
  return { resource, quota, projected, exceeded };
}
