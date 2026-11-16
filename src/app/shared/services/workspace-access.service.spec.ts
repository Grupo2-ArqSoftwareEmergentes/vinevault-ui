import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WorkspaceScopeService } from './workspace-scope.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { SpacePermission, SpaceRole, hasSpacePermission } from '../../device/domain/model/valueobjects/space-access';
import { ownerAccess } from '../testing/workspace.fixtures';
import { CanSpaceDirective } from '../directives/can-space.directive';

@Component({ standalone: true, imports: [CanSpaceDirective], template: `<button *appCan="'CONFIGURE'" class="configure">Configure</button><button *appCan="'INVENTORY'" class="inventory">Import</button><button *appCan="'MANAGE'" class="manage">Delete space</button>` })
class PermissionHost {}

describe('Space RBAC and subscription state', () => {
  const matrix: Record<SpaceRole, SpacePermission[]> = {
    OWNER: ['READ', 'CONFIGURE', 'INVENTORY', 'ANALYZE', 'MANAGE'],
    SOMMELIER: ['READ', 'CONFIGURE', 'INVENTORY', 'ANALYZE'],
    INVENTORY_CLERK: ['READ', 'INVENTORY', 'ANALYZE'],
    WAITER: ['READ'],
  };
  for (const role of Object.keys(matrix) as SpaceRole[]) {
    for (const permission of ['READ', 'CONFIGURE', 'INVENTORY', 'ANALYZE', 'MANAGE'] as SpacePermission[]) {
      it(`${role}: ${permission} follows the backend matrix`, () => {
        expect(hasSpacePermission({ role }, permission)).toBe(matrix[role].includes(permission));
      });
    }
  }

  it('denies every permission if the role is missing or unknown', () => {
    expect(hasSpacePermission({}, 'MANAGE')).toBe(false);
    expect(hasSpacePermission(null, 'READ')).toBe(false);
    expect(hasSpacePermission({ role: 'ADMIN' as SpaceRole }, 'CONFIGURE')).toBe(false);
  });

  it('reactively switches purpose, plan, status and permissions as one space context', async () => {
    TestBed.configureTestingModule({ imports: [PermissionHost] });
    const scope = TestBed.inject(WorkspaceScopeService);
    const access = TestBed.inject(WorkspaceAccessService);
    const fixture = TestBed.createComponent(PermissionHost);
    scope.activate({ ...ownerAccess, id: { value: 'home' }, name: 'Home' });
    await fixture.whenStable();
    expect(access.plan()).toBe('FREE');
    expect(fixture.nativeElement.querySelector('.manage')).toBeTruthy();
    const oldSignal = scope.signal;
    scope.activate({ ...ownerAccess, id: { value: 'restaurant' }, name: 'Restaurant', spaceType: 'BUSINESS', subscriptionPlan: 'BUSINESS', subscriptionStatus: 'EXPIRED', role: 'WAITER' });
    await fixture.whenStable();
    expect(oldSignal.aborted).toBe(true);
    expect(access.purpose()).toBe('BUSINESS');
    expect(access.plan()).toBe('BUSINESS');
    expect(access.status()).toBe('EXPIRED');
    expect(access.role()).toBe('WAITER');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    scope.activate(null, true);
    expect(access.plan()).toBeNull();
    expect(access.canManage()).toBe(false);
  });
});
