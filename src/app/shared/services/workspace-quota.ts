import { HttpErrorResponse } from '@angular/common/http';
import { AccountQuota, ResourceQuota, WorkspaceSpace } from '../models/workspace-context';
import { hasSpacePermission, SpaceType } from '../../device/domain/model/valueobjects/space-access';

export type QuotaErrorCode = 'SPACE_LIMIT_REACHED' | 'CELLAR_LIMIT_REACHED' | 'ITEM_LIMIT_REACHED';
export type SubscriptionErrorCode =
  | QuotaErrorCode
  | 'PLAN_FEATURE_UNAVAILABLE'
  | 'FORBIDDEN'
  | 'ALREADY_PRO'
  | 'UPGRADE_PENDING'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CURRENCY_UNAVAILABLE'
  | 'SPACE_REQUIRED'
  | 'CELLAR_NOT_FOUND';

export interface StructuredApiErrorDetail<Code extends string = string> {
  code: Code;
  message: string;
  current?: number;
  limit?: number;
}

const quotaMessages: Record<QuotaErrorCode, string> = {
  SPACE_LIMIT_REACHED: 'No hay cupo para otro espacio del tipo solicitado.',
  CELLAR_LIMIT_REACHED: 'Amplía el cupo de cavas o cambia de plan.',
  ITEM_LIMIT_REACHED: 'Reduce la cantidad, libera SKUs o cambia de plan.',
};

const subscriptionErrorMessages: Record<SubscriptionErrorCode, string> = {
  ...quotaMessages,
  PLAN_FEATURE_UNAVAILABLE: 'Esta función de IA no está incluida en el plan actual de este espacio.',
  FORBIDDEN: 'No tienes permisos suficientes sobre este espacio para realizar esta acción.',
  ALREADY_PRO: 'Este espacio ya cuenta con el plan Pro.',
  UPGRADE_PENDING: 'Ya existe una solicitud de upgrade a Pro pendiente de pago para este espacio.',
  IDEMPOTENCY_CONFLICT: 'Los parámetros de la solicitud cambiaron. Hemos renovado la clave para que puedas intentarlo de nuevo.',
  CURRENCY_UNAVAILABLE: 'La moneda elegida no está disponible para este producto.',
  SPACE_REQUIRED: 'Selecciona un espacio antes de consultar la suscripción de una cava.',
  CELLAR_NOT_FOUND: 'La cava indicada no pertenece a este espacio.',
};

export function apiErrorDetail(error: unknown): StructuredApiErrorDetail | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const detail = error.error?.detail;
  if (!detail || typeof detail !== 'object' || typeof detail.code !== 'string' || !detail.code.trim()) return null;
  const code = detail.code.trim();
  const fallback = Object.prototype.hasOwnProperty.call(subscriptionErrorMessages, code)
    ? subscriptionErrorMessages[code as SubscriptionErrorCode]
    : '';
  const message = typeof detail.message === 'string' && detail.message.trim() ? detail.message.trim() : fallback;
  const result: StructuredApiErrorDetail = { code, message };
  if (typeof detail.current === 'number' && Number.isFinite(detail.current)) result.current = detail.current;
  if (typeof detail.limit === 'number' && Number.isFinite(detail.limit)) result.limit = detail.limit;
  return result;
}

export function quotaErrorDetail(error: unknown): StructuredApiErrorDetail<QuotaErrorCode> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return null;
  const detail = apiErrorDetail(error);
  if (!detail || !Object.prototype.hasOwnProperty.call(quotaMessages, detail.code)) return null;
  return detail as StructuredApiErrorDetail<QuotaErrorCode>;
}

export function planFeatureUnavailableDetail(error: unknown): StructuredApiErrorDetail<'PLAN_FEATURE_UNAVAILABLE'> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return null;
  const detail = apiErrorDetail(error);
  if (detail?.code !== 'PLAN_FEATURE_UNAVAILABLE') return null;
  return detail as StructuredApiErrorDetail<'PLAN_FEATURE_UNAVAILABLE'>;
}

export function subscriptionErrorDetail(error: unknown): StructuredApiErrorDetail<SubscriptionErrorCode> | null {
  const detail = apiErrorDetail(error);
  if (!detail || !Object.prototype.hasOwnProperty.call(subscriptionErrorMessages, detail.code)) return null;
  return detail as StructuredApiErrorDetail<SubscriptionErrorCode>;
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
