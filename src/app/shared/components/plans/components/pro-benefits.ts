import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';
import { SubscriptionCatalogPlan } from '../../../models/subscription';

export function proBenefits(purpose: SpaceType | null, plan?: SubscriptionCatalogPlan | null): readonly string[] {
  const limits = plan?.limits;
  const cellarFeature = limits?.cellars !== undefined
    ? limits.cellars === null
      ? (purpose === 'BUSINESS' ? 'Almacenes y cavas sin límite.' : 'Cavas sin límite.')
      : purpose === 'BUSINESS'
        ? `Hasta ${limits.cellars} almacenes/cavas base incluidos (+ add-ons).`
        : `Hasta ${limits.cellars} cavas base incluidas (+ add-ons).`
    : null;

  const inventoryLimit = purpose === 'BUSINESS' ? limits?.skus : limits?.bottles;
  const inventoryFeature = inventoryLimit !== undefined
    ? purpose === 'BUSINESS'
      ? (inventoryLimit === null ? 'SKUs sin límite: amplía las referencias de tu negocio.' : `Hasta ${inventoryLimit} SKUs en todo el espacio.`)
      : (inventoryLimit === null ? 'Botellas sin límite para hacer crecer tu colección.' : `Hasta ${inventoryLimit} botellas en todo el espacio.`)
    : null;

  const aiFeature = plan?.features?.stock_analysis && plan.features.assistant_chat ? 'Análisis y asistente de inventario con IA habilitados.' : null;

  return [
    ...(cellarFeature ? [cellarFeature] : []),
    ...(inventoryFeature ? [inventoryFeature] : []),
    ...(aiFeature ? [aiFeature] : []),
    ...(plan?.features?.autocomplete ? ['Autocompletado de fichas con IA.'] : []),
    ...(plan?.features?.sommelier_analysis ? ['Diagnóstico del inventario con Sommelier.'] : []),
    ...(plan?.features?.pdf_report ? ['Reporte de inventario en PDF.'] : []),
    ...(plan?.features?.excel_export ? ['Exportación Excel, plantilla e importación de inventario.'] : []),
  ];
}
