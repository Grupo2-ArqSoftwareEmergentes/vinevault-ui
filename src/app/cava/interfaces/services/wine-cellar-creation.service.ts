import { Injectable, Injector, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, Observable, catchError, filter, of, switchMap, take, tap } from 'rxjs';
import { WineCellarDialogComponent, WineCellarDialogResult } from '../components/wine-cellar-dialog/wine-cellar-dialog.component';
import { WineCellarCommandServiceImpl } from '../../application/internal/commandservices/wine-cellar-command-service.impl';
import { WineCellar } from '../../domain/services/wine-cellar-query-service';
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';
import { workspaceErrorMessage } from '../../../shared/services/workspace-api.service';
import { canCreateCellar, quotaErrorDetail } from '../../../shared/services/workspace-quota';
import { hasSpacePermission } from '../../../device/domain/model/valueobjects/space-access';
import { CellarLimitService } from '../../../shared/services/cellar-limit.service';

/** Shared full-dialog creation flow for the Topbar and cellar view. */
@Injectable()
export class WineCellarCreationService {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly injector = inject(Injector);
  private readonly cellarLimit = inject(CellarLimitService);

  open(spaceId: string): Observable<WineCellar> {
    const canCreate = () => {
      const space = this.workspace.spaces().find(item => item.id.value === spaceId);
      // Legacy contexts can omit quotas. Do not override explicit server allowances.
      const freePrincipalExists = !space?.quotas && space?.subscriptionPlan === 'FREE'
        && this.workspace.cellars().some(cellar => cellar.spaceId.value === spaceId);
      return canCreateCellar(space) && !freePrincipalExists;
    };
    const checkCapacity = () => {
      const space = this.workspace.spaces().find(item => item.id.value === spaceId);
      if (!hasSpacePermission(space, 'CONFIGURE')) return false;
      if (!canCreate()) { this.cellarLimit.open(spaceId); return false; }
      return true;
    };
    if (!checkCapacity()) return EMPTY;
    let linkFailed = false;
    return this.dialog.open(WineCellarDialogComponent, {
      width: '720px', maxWidth: '95vw', panelClass: 'cava-management-dialog',
      data: { title: 'Crear cava', submitLabel: 'Crear', spaceId, canCreate },
    }).afterClosed().pipe(
      take(1),
      filter((result: WineCellarDialogResult | undefined): result is WineCellarDialogResult => !!result),
      switchMap((result) => {
        if (!checkCapacity()) return EMPTY;
        const commands = this.injector.get(WineCellarCommandServiceImpl);
        return commands.createWineCellar(spaceId, { name: result.name, description: result.description }).pipe(
          switchMap((created) => result.deviceId ? commands.linkDevice(created.id.value, result.deviceId).pipe(
            // The cellar already exists: do not lose it or repeat creation if linking fails.
            catchError((error: unknown) => {
              linkFailed = true;
              this.snackBar.open(workspaceErrorMessage(error, 'Cava creada, pero no se pudo vincular el dispositivo.'), 'Close', { duration: 5000 });
              return of(created);
            })
          ) : of(created))
        );
      }),
      tap((created) => {
        this.workspace.upsertCellar(created, this.workspace.selection().space?.id.value === spaceId, true);
        if (!linkFailed) this.snackBar.open('Cava creada', 'Close', { duration: 3000 });
      }),
      catchError((error: unknown) => {
        if (quotaErrorDetail(error)?.code === 'CELLAR_LIMIT_REACHED') {
          this.cellarLimit.open(spaceId);
          return EMPTY;
        }
        this.snackBar.open(workspaceErrorMessage(error, 'No se pudo crear la cava'), 'Close', { duration: 3500 });
        return EMPTY;
      })
    );
  }
}
