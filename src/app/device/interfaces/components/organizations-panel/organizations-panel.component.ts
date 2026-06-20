import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OrganizationsBarComponent } from '../organizations-bar/organizations-bar.component';
import { AddOrganizationDialogComponent } from '../add-organization-dialog/add-organization-dialog.component';
import { AddSpaceDialogComponent } from '../add-space-dialog/add-space-dialog.component';
import { DeleteOrganizationDialogComponent } from '../delete-organization-dialog/delete-organization-dialog.component';
import { EditNameDialogComponent } from '../edit-name-dialog/edit-name-dialog.component';
import { DEVICE_COMMAND_SERVICE, DeviceCommandService } from '../../../domain/services/device-command-service';
import { DEVICE_QUERY_SERVICE, DeviceQueryService } from '../../../domain/services/device-query-service';
import { Organization, Space } from '../../../domain/services/device-query-service';
import { OrganizationId, createOrganizationId } from '../../../domain/model/valueobjects/organization-id.value-object';
import { SpaceId } from '../../../domain/model/valueobjects/space-id.value-object';
import { createGetSpacesByOrganizationQuery } from '../../../domain/model/queries/get-spaces-by-organization.query';
import { createGetDevicesBySpaceQuery } from '../../../domain/model/queries/get-devices-by-space.query';
import { createCreateOrganizationCommand } from '../../../domain/model/commands/create-organization.command';
import { createUpdateOrganizationNameCommand } from '../../../domain/model/commands/update-organization-name.command';
import { createDeleteOrganizationCommand } from '../../../domain/model/commands/delete-organization.command';
import { createCreateSpaceCommand } from '../../../domain/model/commands/create-space.command';
import { createUpdateSpaceNameCommand } from '../../../domain/model/commands/update-space-name.command';
import { from, of } from 'rxjs';
import { catchError, finalize, map, mergeMap, tap } from 'rxjs/operators';
import { createGetCurrentUserOrganizationsQuery } from '../../../domain/model/queries/get-current-user-organizations.query';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { extractApiErrorMessage } from '../../rest/transform/extract-api-error-message.transform';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';

@Component({
  selector: 'app-organizations-panel',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatSnackBarModule, OrganizationsBarComponent],
  templateUrl: './organizations-panel.component.html',
  styleUrl: './organizations-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationsPanelComponent implements OnInit {
  private readonly deviceCommandService = inject(DEVICE_COMMAND_SERVICE) as DeviceCommandService;
  private readonly deviceQueryService = inject(DEVICE_QUERY_SERVICE) as DeviceQueryService;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly wineCellarQueryService = inject(WineCellarQueryServiceImpl);

  @Input() selectedSpaceId: string | null = null;
  @Input() countMode: 'devices' | 'cavas' = 'devices';
  @Output() spaceSelected = new EventEmitter<Space>();
  @Output() selectedSpaceCleared = new EventEmitter<void>();

  organizations: Organization[] = [];
  expandedOrganizationIds: Record<string, boolean> = {};
  spacesByOrganizationId: Record<string, Space[]> = {};
  loadingSpacesByOrganizationId: Record<string, boolean> = {};
  errorSpacesByOrganizationId: Record<string, string> = {};
  spaceCountsBySpaceId: Record<string, number> = {};
  private readonly spaceCountsInFlightBySpaceId = new Set<string>();
  private restoredExpandedState = false;

  private static readonly expandedOrganizationsStorageKey = 'clair.organizationsPanel.expandedOrganizationIds';

  ngOnInit(): void {
    this.loadOrganizations();
  }

  toggleOrganization(orgId: OrganizationId): void {
    const key = orgId.value;
    this.expandedOrganizationIds = {
      ...this.expandedOrganizationIds,
      [key]: !this.expandedOrganizationIds[key],
    };

    this.persistExpandedOrganizations();

    if (this.expandedOrganizationIds[key] && !this.spacesByOrganizationId[key] && !this.loadingSpacesByOrganizationId[key]) {
      this.loadSpaces(orgId);
    }
  }

  ensureOrganizationExpanded(orgId: OrganizationId): void {
    const key = orgId.value;
    if (this.expandedOrganizationIds[key]) return;

    this.expandedOrganizationIds = {
      ...this.expandedOrganizationIds,
      [key]: true,
    };

    this.persistExpandedOrganizations();

    if (!this.spacesByOrganizationId[key] && !this.loadingSpacesByOrganizationId[key]) {
      this.loadSpaces(orgId);
    }
  }

  selectSpace(spaceId: SpaceId): void {
    const space = this.allSpaces.find((currentSpace) => currentSpace.id.value === spaceId.value);
    if (space) this.spaceSelected.emit(space);
  }

  openAddOrganizationDialog(): void {
    const dialogRef = this.dialog.open(AddOrganizationDialogComponent, { width: '400px' });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((name: string | undefined) => {
      if (!name) return;
      const command = createCreateOrganizationCommand(name);
      this.deviceCommandService.handleCreateOrganization(command).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open('Organization created', 'Close', { duration: 3000 });
          this.loadOrganizations();
        },
        error: (error) =>
          this.snackBar.open(extractApiErrorMessage(error, 'Failed to create organization'), 'Close', { duration: 3000 }),
      });
    });
  }

  openEditOrganizationDialog(orgId: OrganizationId): void {
    const organization = this.organizations.find((org) => org.id.value === orgId.value);
    if (!organization) return;
    const dialogRef = this.dialog.open(EditNameDialogComponent, {
      width: '400px',
      data: {
        currentValue: organization.name,
        title: 'Edit Organization',
        fieldLabel: 'Organization Name',
        placeholder: 'Enter organization name',
      },
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((name: string | undefined) => {
      if (!name) return;
      const command = createUpdateOrganizationNameCommand(orgId, name);
      this.deviceCommandService.handleUpdateOrganizationName(command).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open('Organization updated', 'Close', { duration: 3000 });
          this.loadOrganizations();
        },
        error: (error) =>
          this.snackBar.open(extractApiErrorMessage(error, 'Failed to update organization'), 'Close', { duration: 3000 }),
      });
    });
  }

  openDeleteOrganizationDialog(orgId: OrganizationId): void {
    const dialogRef = this.dialog.open(DeleteOrganizationDialogComponent, { width: '400px' });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      const command = createDeleteOrganizationCommand(orgId);
      this.deviceCommandService.handleDeleteOrganization(command).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open('Organization deleted', 'Close', { duration: 3000 });
          if (this.spacesByOrganizationId[orgId.value]?.some((space) => space.id.value === this.selectedSpaceId)) {
            this.selectedSpaceCleared.emit();
          }
          this.loadOrganizations();
        },
        error: (error) =>
          this.snackBar.open(extractApiErrorMessage(error, 'Failed to delete organization'), 'Close', { duration: 3000 }),
      });
    });
  }

  openAddSpaceDialog(orgId: OrganizationId): void {
    const dialogRef = this.dialog.open(AddSpaceDialogComponent, { width: '400px' });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((name: string | undefined) => {
      if (!name) return;
      const command = createCreateSpaceCommand(name, orgId);
      this.deviceCommandService.handleCreateSpace(command).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open('Space created', 'Close', { duration: 3000 });
          this.loadSpaces(orgId);
        },
        error: (error) => this.snackBar.open(extractApiErrorMessage(error, 'Failed to create space'), 'Close', { duration: 3000 }),
      });
    });
  }

  openEditSpaceDialog(spaceId: SpaceId): void {
    const space = this.allSpaces.find((currentSpace) => currentSpace.id.value === spaceId.value);
    if (!space) return;
    const dialogRef = this.dialog.open(EditNameDialogComponent, {
      width: '400px',
      data: {
        currentValue: space.name,
        title: 'Edit Space',
        fieldLabel: 'Space Name',
        placeholder: 'Enter space name',
      },
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((name: string | undefined) => {
      if (!name) return;
      const command = createUpdateSpaceNameCommand(spaceId, name);
      this.deviceCommandService.handleUpdateSpaceName(command).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open('Space updated', 'Close', { duration: 3000 });
          this.loadSpaces(space.organizationId);
        },
        error: (error) => this.snackBar.open(extractApiErrorMessage(error, 'Failed to update space'), 'Close', { duration: 3000 }),
      });
    });
  }

  private loadOrganizations(): void {
    const query = createGetCurrentUserOrganizationsQuery();
    this.deviceQueryService.handleGetCurrentUserOrganizations(query).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (orgs) => {
        this.organizations = orgs;
        this.restoreExpandedOrganizationsIfNeeded();
        this.cdr.markForCheck();
      },
      error: (error) =>
        this.snackBar.open(extractApiErrorMessage(error, 'Failed to load organizations'), 'Close', { duration: 3000 }),
    });
  }

  loadSpaces(orgId: OrganizationId): void {
    const key = orgId.value;
    this.loadingSpacesByOrganizationId = { ...this.loadingSpacesByOrganizationId, [key]: true };
    this.errorSpacesByOrganizationId = { ...this.errorSpacesByOrganizationId, [key]: '' };
    this.cdr.markForCheck();
    const query = createGetSpacesByOrganizationQuery(orgId);
    this.deviceQueryService.handleGetSpacesByOrganization(query).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (spaces) => {
        this.spacesByOrganizationId = { ...this.spacesByOrganizationId, [key]: spaces };
        this.loadingSpacesByOrganizationId = { ...this.loadingSpacesByOrganizationId, [key]: false };
        this.loadSpaceCountsForSpaces(spaces);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorSpacesByOrganizationId = {
          ...this.errorSpacesByOrganizationId,
          [key]: extractApiErrorMessage(error, 'Failed to load spaces'),
        };
        this.loadingSpacesByOrganizationId = { ...this.loadingSpacesByOrganizationId, [key]: false };
        this.cdr.markForCheck();
      },
    });
  }

  private loadSpaceCountsForSpaces(spaces: Space[]): void {
    if (spaces.length === 0) return;

    const spacesToFetch = spaces.filter(
      (space) =>
        !(space.id.value in this.spaceCountsBySpaceId) && !this.spaceCountsInFlightBySpaceId.has(space.id.value)
    );
    if (spacesToFetch.length === 0) return;

    spacesToFetch.forEach((space) => this.spaceCountsInFlightBySpaceId.add(space.id.value));

    from(spacesToFetch)
      .pipe(
        mergeMap(
          (space) =>
            this.countMode === 'cavas'
              ? this.wineCellarQueryService.getWineCellarsBySpace(space.id.value).pipe(
                  map((wineCellars) => ({ spaceId: space.id.value, totalElements: wineCellars.length })),
                  catchError(() => of({ spaceId: space.id.value, totalElements: 0 })),
                  finalize(() => this.spaceCountsInFlightBySpaceId.delete(space.id.value))
                )
              : this.deviceQueryService.handleGetDevicesBySpace(createGetDevicesBySpaceQuery(space.id, 0, 1)).pipe(
                  map((page) => ({ spaceId: space.id.value, totalElements: page.totalElements })),
                  catchError(() => of({ spaceId: space.id.value, totalElements: 0 })),
                  finalize(() => this.spaceCountsInFlightBySpaceId.delete(space.id.value))
                ),
          4
        ),
        tap(({ spaceId, totalElements }) => {
          this.spaceCountsBySpaceId = { ...this.spaceCountsBySpaceId, [spaceId]: totalElements };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private get allSpaces(): Space[] {
    return Object.values(this.spacesByOrganizationId).flat();
  }

  private restoreExpandedOrganizationsIfNeeded(): void {
    if (this.restoredExpandedState) return;
    this.restoredExpandedState = true;

    const expandedIds = this.loadExpandedOrganizations();
    if (expandedIds.length === 0) return;

    const existingOrgIds = new Set(this.organizations.map((org) => org.id.value));
    const validExpandedIds = expandedIds.filter((orgId) => existingOrgIds.has(orgId));

    if (validExpandedIds.length === 0) return;

    this.expandedOrganizationIds = validExpandedIds.reduce<Record<string, boolean>>((acc, orgId) => {
      acc[orgId] = true;
      return acc;
    }, {});

    validExpandedIds.forEach((orgId) => this.loadSpaces(createOrganizationId(orgId)));
  }

  private persistExpandedOrganizations(): void {
    const expandedIds = Object.entries(this.expandedOrganizationIds)
      .filter(([, expanded]) => expanded)
      .map(([orgId]) => orgId);
    localStorage.setItem(OrganizationsPanelComponent.expandedOrganizationsStorageKey, JSON.stringify(expandedIds));
  }

  private loadExpandedOrganizations(): string[] {
    const raw = localStorage.getItem(OrganizationsPanelComponent.expandedOrganizationsStorageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    } catch {
      return [];
    }
  }

  // NOTE: error parsing centralized in extractApiErrorMessage()
}
