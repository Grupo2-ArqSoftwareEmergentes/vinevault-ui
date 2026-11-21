import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';
import { SubscriptionCatalogPlan } from '../../../models/subscription';
import { TranslationParams } from '../../../../core/i18n/i18n.service';

export function proBenefits(purpose: SpaceType | null, plan?: SubscriptionCatalogPlan | null,
  translate: (key: string, params?: TranslationParams) => string = (key, params = {}) => key.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))): readonly string[] {
  const limits = plan?.limits;
  const cellarFeature = limits?.cellars !== undefined
    ? limits.cellars === null
      ? (purpose === 'BUSINESS' ? 'Almacenes y cavas sin límite.' : 'Cavas sin límite.')
      : purpose === 'BUSINESS'
        ? translate('Hasta {count} almacenes/cavas base incluidos (+ add-ons).', { count: limits.cellars })
        : translate('Hasta {count} cavas base incluidas (+ add-ons).', { count: limits.cellars })
    : null;

  const inventoryLimit = purpose === 'BUSINESS' ? limits?.skus : limits?.bottles;
  const inventoryFeature = inventoryLimit !== undefined
    ? purpose === 'BUSINESS'
      ? (inventoryLimit === null ? 'SKUs sin límite: amplía las referencias de tu negocio.' : translate('Hasta {count} SKUs en todo el espacio.', { count: inventoryLimit }))
      : (inventoryLimit === null ? 'Botellas sin límite para hacer crecer tu colección.' : translate('Hasta {count} botellas en todo el espacio.', { count: inventoryLimit }))
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
  ].map(value => translate(value));
}
