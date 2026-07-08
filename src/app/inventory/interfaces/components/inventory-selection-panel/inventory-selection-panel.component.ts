import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, of } from 'rxjs';

import {
  DEVICE_QUERY_SERVICE,
  DeviceQueryService,
  Organization,
  Space,
} from '../../../../device/domain/services/device-query-service';
import { createGetCurrentUserOrganizationsQuery } from '../../../../device/domain/model/queries/get-current-user-organizations.query';
import { createGetSpacesByOrganizationQuery } from '../../../../device/domain/model/queries/get-spaces-by-organization.query';
import { createOrganizationId } from '../../../../device/domain/model/valueobjects/organization-id.value-object';
import { WineCellar, WineCellarQueryService } from '../../../../cava/domain/services/wine-cellar-query-service';
import { WineCellarQueryServiceImpl } from '../../../../cava/application/internal/queryservices/wine-cellar-query-service.impl';

@Component({
  selector: 'app-inventory-selection-panel',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './inventory-selection-panel.component.html',
  styleUrl: './inventory-selection-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventorySelectionPanelComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly deviceQueryService = inject(DEVICE_QUERY_SERVICE) as DeviceQueryService;
  private readonly wineCellarQueryService = inject(WineCellarQueryServiceImpl) as WineCellarQueryService;

  organizations: readonly Organization[] = [];
  spacesByOrganizationId: Record<string, readonly Space[]> = {};
  wineCellarsBySpaceId: Record<string, readonly WineCellar[]> = {};
  loadingOrganizations = false;
  loadingSpacesByOrganizationId: Record<string, boolean> = {};
  loadingWineCellarsBySpaceId: Record<string, boolean> = {};
  errorOrganizations = '';
  errorSpacesByOrganizationId: Record<string, string> = {};
  errorWineCellarsBySpaceId: Record<string, string> = {};

  selectedOrganization: Organization | null = null;
  selectedSpace: Space | null = null;
  selectedWineCellar: WineCellar | null = null;

  ngOnInit(): void {
    this.loadOrganizations();
  }

  get selectedOrganizationSpaces(): readonly Space[] {
    if (!this.selectedOrganization) return [];
    return this.spacesByOrganizationId[this.selectedOrganization.id.value] ?? [];
  }

  get selectedSpaceWineCellars(): readonly WineCellar[] {
    if (!this.selectedSpace) return [];
    return this.wineCellarsBySpaceId[this.selectedSpace.id.value] ?? [];
  }

  get loadingSelectedOrganizationSpaces(): boolean {
    if (!this.selectedOrganization) return false;
    return !!this.loadingSpacesByOrganizationId[this.selectedOrganization.id.value];
  }

  get loadingSelectedSpaceWineCellars(): boolean {
    if (!this.selectedSpace) return false;
    return !!this.loadingWineCellarsBySpaceId[this.selectedSpace.id.value];
  }

  selectOrganization(organizationId: string): void {
    const organization = this.organizations.find((currentOrganization) => currentOrganization.id.value === organizationId) ?? null;
    this.selectedOrganization = organization;
    this.selectedSpace = null;
    this.selectedWineCellar = null;
    this.cdr.markForCheck();

    if (!organization) return;

    if (!this.spacesByOrganizationId[organizationId] && !this.loadingSpacesByOrganizationId[organizationId]) {
      this.loadSpaces(organization.id.value);
    }
  }

  selectSpace(spaceId: string): void {
    const space = this.selectedOrganizationSpaces.find((currentSpace) => currentSpace.id.value === spaceId) ?? null;
    this.selectedSpace = space;
    this.selectedWineCellar = null;
    this.cdr.markForCheck();

    if (!space) return;

    if (!this.wineCellarsBySpaceId[spaceId] && !this.loadingWineCellarsBySpaceId[spaceId]) {
      this.loadWineCellars(spaceId);
    }
  }

  selectWineCellar(wineCellarId: string): void {
    this.selectedWineCellar = this.selectedSpaceWineCellars.find((cellar) => cellar.id.value === wineCellarId) ?? null;
    this.cdr.markForCheck();
  }

  trackByOrganizationId(_index: number, organization: Organization): string {
    return organization.id.value;
  }

  trackBySpaceId(_index: number, space: Space): string {
    return space.id.value;
  }

  trackByWineCellarId(_index: number, cellar: WineCellar): string {
    return cellar.id.value;
  }

  private loadOrganizations(): void {
    if (this.loadingOrganizations) return;
    this.loadingOrganizations = true;
    this.errorOrganizations = '';
    this.cdr.markForCheck();

    this.deviceQueryService
      .handleGetCurrentUserOrganizations(createGetCurrentUserOrganizationsQuery())
      .pipe(
        catchError((error: unknown) => {
          this.errorOrganizations = error instanceof Error ? error.message : 'No se pudieron cargar las organizaciones';
          this.cdr.markForCheck();
          return of([] as readonly Organization[]);
        }),
        finalize(() => {
          this.loadingOrganizations = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((organizations) => {
        this.organizations = organizations;
        this.cdr.markForCheck();
      });
  }

  private loadSpaces(organizationId: string): void {
    this.loadingSpacesByOrganizationId = { ...this.loadingSpacesByOrganizationId, [organizationId]: true };
    this.errorSpacesByOrganizationId = { ...this.errorSpacesByOrganizationId, [organizationId]: '' };
    this.cdr.markForCheck();

    this.deviceQueryService
      .handleGetSpacesByOrganization(createGetSpacesByOrganizationQuery(createOrganizationId(organizationId)))
      .pipe(
        catchError((error: unknown) => {
          this.errorSpacesByOrganizationId = {
            ...this.errorSpacesByOrganizationId,
            [organizationId]: error instanceof Error ? error.message : 'No se pudieron cargar los espacios',
          };
          this.cdr.markForCheck();
          return of([] as readonly Space[]);
        }),
        finalize(() => {
          this.loadingSpacesByOrganizationId = { ...this.loadingSpacesByOrganizationId, [organizationId]: false };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((spaces) => {
        this.spacesByOrganizationId = { ...this.spacesByOrganizationId, [organizationId]: spaces };
        this.cdr.markForCheck();
      });
  }

  private loadWineCellars(spaceId: string): void {
    this.loadingWineCellarsBySpaceId = { ...this.loadingWineCellarsBySpaceId, [spaceId]: true };
    this.errorWineCellarsBySpaceId = { ...this.errorWineCellarsBySpaceId, [spaceId]: '' };
    this.cdr.markForCheck();

    this.wineCellarQueryService
      .getWineCellarsBySpace(spaceId)
      .pipe(
        catchError((error: unknown) => {
          this.errorWineCellarsBySpaceId = {
            ...this.errorWineCellarsBySpaceId,
            [spaceId]: error instanceof Error ? error.message : 'No se pudieron cargar las cavas',
          };
          this.cdr.markForCheck();
          return of([] as readonly WineCellar[]);
        }),
        finalize(() => {
          this.loadingWineCellarsBySpaceId = { ...this.loadingWineCellarsBySpaceId, [spaceId]: false };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((wineCellars) => {
        this.wineCellarsBySpaceId = { ...this.wineCellarsBySpaceId, [spaceId]: wineCellars };
        this.cdr.markForCheck();
      });
  }
}
