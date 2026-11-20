import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';
import { SubscriptionCatalogPlan } from '../../../models/subscription';

export function proBenefits(purpose: SpaceType | null, plan?: SubscriptionCatalogPlan | null): readonly string[] {
  const limits = plan?.limits;
  const cellarFeature = limits
    ? limits.cellars === null
      ? (purpose === 'BUSINESS' ? 'Almacenes y cavas sin límite.' : 'Cavas sin límite.')
      : purpose === 'BUSINESS'
        ? `Hasta ${limits.cellars} almacenes/cavas base incluidos (+ add-ons).`
        : `Hasta ${limits.cellars} cavas base incluidas (+ add-ons).`
    : null;

  const inventoryFeature = limits
    ? purpose === 'BUSINESS'
      ? (limits.skus === null ? 'SKUs sin límite: amplía las referencias de tu negocio.' : `Hasta ${limits.skus} SKUs en todo el espacio.`)
      : (limits.bottles === null ? 'Botellas sin límite para hacer crecer tu colección.' : `Hasta ${limits.bottles} botellas en todo el espacio.`)
    : null;

  const aiFeature = plan?.can_analyze ? 'Análisis y asistente de inventario con IA habilitados.' : null;

  return [
    ...(cellarFeature ? [cellarFeature] : []),
    ...(inventoryFeature ? [inventoryFeature] : []),
    ...(aiFeature ? [aiFeature] : []),
    ...(purpose === 'BUSINESS'
      ? ['Multiusuario con roles: Sommelier, Encargado y Mesero.', 'Carta de Vinos Digital (QR).', 'Reportes de rotación y márgenes.']
      : ['Alertas de ventana de consumo.', 'Exportación PDF/CSV.', 'Valorización financiera.']),
  ];
}
