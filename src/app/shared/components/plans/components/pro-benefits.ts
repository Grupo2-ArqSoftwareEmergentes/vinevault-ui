import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';

export function proBenefits(purpose: SpaceType | null): readonly string[] {
  return [
    purpose === 'BUSINESS' ? 'Hasta 3 almacenes/cavas incluidos (+ add-ons).' : 'Hasta 3 cavas incluidas (+ add-ons).',
    purpose === 'BUSINESS' ? 'SKUs sin límite: amplía las referencias de tu negocio.' : 'Botellas sin límite para hacer crecer tu colección.',
    ...(purpose === 'BUSINESS'
      ? ['Multiusuario con roles: Sommelier y Mesero.', 'Carta de Vinos Digital (QR).', 'Reportes de rotación y márgenes.']
      : ['Alertas de ventana de consumo.', 'Exportación PDF/CSV.', 'Valorización financiera.']),
  ];
}
