import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Organization, Space } from '../../../domain/services/device-query-service';
import { SpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { OrganizationId } from '../../../domain/model/valueobjects/organization-id.value-object';

@Component({
  selector: 'app-organizations-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './organizations-bar.component.html',
  styleUrl: './organizations-bar.component.css',
})
export class OrganizationsBarComponent implements OnInit {
  @Input() organizations: Organization[] = [];
  @Input() expandedOrganizationIds: Record<string, boolean> = {};
  @Input() spacesByOrganizationId: Record<string, Space[]> = {};
  @Input() loadingSpacesByOrganizationId: Record<string, boolean> = {};
  @Input() errorSpacesByOrganizationId: Record<string, string> = {};
  @Input() deviceCountsBySpaceId: Record<string, number> = {};
  @Input() selectedSpaceId: string | null = null;

  @Output() organizationToggled = new EventEmitter<OrganizationId>();
  @Output() spaceSelected = new EventEmitter<SpaceId>();
  @Output() addSpaceRequested = new EventEmitter<OrganizationId>();
  @Output() editSpaceRequested = new EventEmitter<SpaceId>();
  @Output() editOrganizationRequested = new EventEmitter<OrganizationId>();
  @Output() deleteOrganizationRequested = new EventEmitter<OrganizationId>();
  @Output() addOrganizationRequested = new EventEmitter<void>();

  ngOnInit(): void {}

  toggleOrganization(orgId: OrganizationId): void {
    this.organizationToggled.emit(orgId);
  }

  selectSpace(spaceId: SpaceId): void {
    this.spaceSelected.emit(spaceId);
  }

  openAddSpaceDialog(orgId: OrganizationId): void {
    this.addSpaceRequested.emit(orgId);
  }

  openEditSpaceDialog(spaceId: SpaceId): void {
    this.editSpaceRequested.emit(spaceId);
  }

  openEditOrganizationDialog(orgId: OrganizationId): void {
    this.editOrganizationRequested.emit(orgId);
  }

  openDeleteOrganizationDialog(orgId: OrganizationId): void {
    this.deleteOrganizationRequested.emit(orgId);
  }

  openAddOrganizationDialog(): void {
    this.addOrganizationRequested.emit();
  }

  trackBySpaceId(_: number, space: Space): string {
    return space.id.value;
  }

  trackByOrganizationId(_: number, organization: Organization): string {
    return organization.id.value;
  }
}
