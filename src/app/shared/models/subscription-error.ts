import { apiErrorDetail } from '../services/workspace-quota';
import { extractApiErrorMessage } from '../../device/interfaces/rest/transform/extract-api-error-message.transform';

export function subscriptionErrorMessage(error: unknown): string {
  const messages: Record<string, string> = {
    FORBIDDEN: 'No tienes permisos para realizar esta acción.',
    CELLAR_NOT_FOUND: 'La cava no pertenece al espacio seleccionado. Revisa la selección.',
    ALREADY_PRO: 'El espacio ya es PRO. Actualizando su estado…',
    UPGRADE_PENDING: 'Ya existe una solicitud pendiente de pago para este espacio.',
    IDEMPOTENCY_CONFLICT: 'La clave corresponde a otros datos. Se generó una nueva clave para esta acción; vuelve a confirmar.',
    SUBSCRIPTION_EXPIRED: 'El ciclo ya terminó. Actualiza el estado de suscripción.',
    SIMULATED_ACTIVATION_REQUIRES_PEN: 'La activación simulada solo está disponible en soles.',
    CURRENCY_UNAVAILABLE: 'La moneda no tiene tarifa disponible. Actualiza el catálogo.',
  };
  return messages[apiErrorDetail(error)?.code ?? ''] ?? extractApiErrorMessage(error, 'No se pudo completar la operación. Puedes reintentar sin duplicarla.');
}
