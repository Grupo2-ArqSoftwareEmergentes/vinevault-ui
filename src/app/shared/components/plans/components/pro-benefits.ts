import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';

export function proBenefits(purpose: SpaceType | null): readonly string[] {
  return [
    'Cavas sin límite en este espacio.',
    purpose === 'BUSINESS' ? 'SKUs sin límite: amplía las referencias de tu negocio.' : 'Botellas sin límite para hacer crecer tu colección.',
    purpose === 'BUSINESS' ? 'Botellas sin límite de stock en todas tus cavas.' : 'SKUs sin límite para organizar tus vinos.',
  ];
}
