import { spaceResourceToDomain } from './space.transform';
import { hasSpacePermission } from '../../../domain/model/valueobjects/space-access';

describe('Independent space resources', () => {
  it('does not require legacy owner or organization fields', () => {
    const space = spaceResourceToDomain({
      id: 'space-1', name: 'Shared restaurant', space_type: 'BUSINESS', subscription_plan: 'PRO',
      subscription_status: 'ACTIVE', role: 'SOMMELIER', created_at: null, updated_at: null,
    });
    expect(space.ownerUserId).toBeNull();
    expect(space.organizationId).toBeNull();
    expect(space.spaceType).toBe('BUSINESS');
    expect(space.subscriptionPlan).toBe('PRO');
    expect(hasSpacePermission(space, 'CONFIGURE')).toBe(true);
    expect(hasSpacePermission(space, 'MANAGE')).toBe(false);
  });

  it('never infers ownership permissions from owner_user_id', () => {
    const space = spaceResourceToDomain({ id: 'space-1', name: 'Legacy', owner_user_id: 1, created_at: null, updated_at: null });
    expect(space.role).toBeNull();
    expect(hasSpacePermission(space, 'MANAGE')).toBe(false);
  });
});
