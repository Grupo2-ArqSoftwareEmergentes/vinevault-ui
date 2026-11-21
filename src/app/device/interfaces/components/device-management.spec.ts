import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';

import { AddOrganizationDialogComponent } from './add-organization-dialog/add-organization-dialog.component';
import { AddSpaceDialogComponent } from './add-space-dialog/add-space-dialog.component';
import { PairDeviceDialogComponent } from './pair-device-dialog/pair-device-dialog.component';
import { OrganizationsBarComponent } from './organizations-bar/organizations-bar.component';
import { DeviceListComponent } from './device-list/device-list.component';
import { SpaceDetailHeaderComponent } from './space-detail-header/space-detail-header.component';
import { createOrganizationId } from '../../domain/model/valueobjects/organization-id.value-object';
import { createSpaceId } from '../../domain/model/valueobjects/space-id.value-object';
import { createUserId } from '../../domain/model/valueobjects/user-id.value-object';
import { Organization, Space } from '../../domain/services/device-query-service';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { ownerAccess } from '../../../shared/testing/workspace.fixtures';

interface ManagementDialog {
  form: FormGroup;
  submit(): void;
  cancel(): void;
}

const dialogs: {
  title: string;
  component: Type<ManagementDialog>;
  control: string;
  value: string;
  result: string | { hardwareId: string };
}[] = [
  { title: 'Add Organization', component: AddOrganizationDialogComponent, control: 'name', value: 'VineVault Estate', result: 'VineVault Estate' },
  { title: 'Add Space', component: AddSpaceDialogComponent, control: 'name', value: 'Reserve Cellar', result: 'Reserve Cellar' },
  { title: 'Pair Sensor Hardware', component: PairDeviceDialogComponent, control: 'hardwareId', value: 'VINE-A001', result: { hardwareId: 'VINE-A001' } },
];

for (const dialog of dialogs) {
  describe(dialog.title, () => {
    let fixture: ComponentFixture<ManagementDialog>;
    const close = vi.fn();

    beforeEach(async () => {
      close.mockReset();
      await TestBed.configureTestingModule({
        imports: [dialog.component],
        providers: [{ provide: MatDialogRef, useValue: { close } }],
      }).compileComponents();
      fixture = TestBed.createComponent(dialog.component);
      await fixture.whenStable();
    });

    it('keeps required fields invalid and the primary action disabled', () => {
      expect(fixture.nativeElement.querySelector('h2').textContent).toBe(({ 'Add Organization': 'Añadir organización', 'Add Space': 'Añadir espacio', 'Pair Sensor Hardware': 'Vincular hardware del sensor' } as Record<string, string>)[dialog.title]);
      expect(fixture.nativeElement.querySelector('.dialog-button--primary').disabled).toBe(true);
      fixture.componentInstance.submit();
      expect(close).not.toHaveBeenCalled();
    });

    it('returns the unchanged payload from the primary action', async () => {
      fixture.componentInstance.form.patchValue({ [dialog.control]: dialog.value });
      await fixture.whenStable();
      const submit = fixture.nativeElement.querySelector('.dialog-button--primary') as HTMLButtonElement;
      expect(submit.disabled).toBe(false);
      submit.click();
      expect(close).toHaveBeenCalledWith(dialog.result);
    });

    it('allows cancellation without submitting a payload', () => {
      fixture.nativeElement.querySelector('.dialog-button:not(.dialog-button--primary)').click();
      expect(close).toHaveBeenCalledOnce();
      expect(close.mock.calls[0][0]).toBeUndefined();
    });

    if (dialog.control === 'hardwareId') {
      it('preserves the VINE hardware ID format validator', () => {
        fixture.componentInstance.form.patchValue({ hardwareId: 'INVALID-123' });
        expect(fixture.componentInstance.form.get('hardwareId')?.hasError('pattern')).toBe(true);
        fixture.componentInstance.submit();
        expect(close).not.toHaveBeenCalled();
      });
    }
  });
}

const organization: Organization = {
  id: createOrganizationId('org-1'), name: 'Estate', ownerUserId: createUserId('user-1'),
  createdAt: null, updatedAt: null,
};
const space: Space = {
  id: createSpaceId('space-1'), name: 'Reserve Cellar', organizationId: organization.id,
  ownerUserId: organization.ownerUserId, createdAt: null, updatedAt: null,
};

describe('Device workspace organization hierarchy', () => {
  let fixture: ComponentFixture<OrganizationsBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OrganizationsBarComponent] }).compileComponents();
    fixture = TestBed.createComponent(OrganizationsBarComponent);
    await fixture.whenStable();
  });

  it('shows the organization empty state and keeps Add Organization connected', () => {
    const add = vi.spyOn(fixture.componentInstance.addOrganizationRequested, 'emit');
    expect(fixture.nativeElement.querySelector('.empty-state').textContent).toContain("No se encontraron organizaciones.");
    fixture.nativeElement.querySelector('.add-org-button').click();
    expect(add).toHaveBeenCalledOnce();
  });

  it('exposes expanded and active states without changing selected space IDs', async () => {
    fixture.componentRef.setInput('organizations', [organization]);
    fixture.componentRef.setInput('expandedOrganizationIds', { 'org-1': true });
    fixture.componentRef.setInput('spacesByOrganizationId', { 'org-1': [space] });
    fixture.componentRef.setInput('selectedSpaceId', 'space-1');
    await fixture.whenStable();
    const select = vi.spyOn(fixture.componentInstance.spaceSelected, 'emit');
    const toggle = vi.spyOn(fixture.componentInstance.organizationToggled, 'emit');
    const organizationButton = fixture.nativeElement.querySelector('.org-row--organization') as HTMLButtonElement;
    const spaceButton = fixture.nativeElement.querySelector('.org-item--space') as HTMLButtonElement;
    expect(organizationButton.getAttribute('aria-expanded')).toBe('true');
    expect(spaceButton.getAttribute('aria-current')).toBe('true');
    expect(spaceButton.classList.contains('active')).toBe(true);
    spaceButton.click();
    expect(select).toHaveBeenCalledWith(space.id);
    organizationButton.click();
    expect(toggle).toHaveBeenCalledWith(organization.id);
  });
});

describe('Device workspace list and space actions', () => {
  it('shows an explicit device empty state and preserves grid/list selection', async () => {
    await TestBed.configureTestingModule({ imports: [DeviceListComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DeviceListComponent);
    fixture.componentRef.setInput('selectedSpace', space);
    fixture.componentRef.setInput('devicesPage', { content: [], totalElements: 0, totalPages: 0, size: 50, number: 0 });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.empty-state').textContent).toContain("No hay dispositivos registrados");
    const change = vi.spyOn(fixture.componentInstance.viewModeChanged, 'emit');
    fixture.nativeElement.querySelector("[aria-label=\"Vista de lista\"]").click();
    expect(change).toHaveBeenCalledWith('list');
    expect(fixture.nativeElement.querySelector("[aria-label=\"Vista de cuadrícula\"]").getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the add sensor action and contextual menu connected', async () => {
    await TestBed.configureTestingModule({ imports: [SpaceDetailHeaderComponent] }).compileComponents();
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: space.id, name: space.name });
    const fixture = TestBed.createComponent(SpaceDetailHeaderComponent);
    fixture.componentRef.setInput('space', space);
    await fixture.whenStable();
    const claim = vi.spyOn(fixture.componentInstance.claimDeviceRequested, 'emit');
    const edit = vi.spyOn(fixture.componentInstance.editSpaceRequested, 'emit');
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe(space.name);
    fixture.nativeElement.querySelector("[aria-label=\"Reclamar sensor\"]").click();
    expect(claim).toHaveBeenCalledOnce();
    fixture.nativeElement.querySelector("[aria-label=\"Más opciones\"]").click();
    await fixture.whenStable();
    const menu = document.querySelector('.device-management-menu')!;
    expect(menu).toBeTruthy();
    (menu.querySelector('button') as HTMLButtonElement).click();
    expect(edit).toHaveBeenCalledOnce();
  });
});
