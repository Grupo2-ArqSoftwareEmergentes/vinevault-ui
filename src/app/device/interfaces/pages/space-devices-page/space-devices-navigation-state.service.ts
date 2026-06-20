import { Injectable } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

export type SpaceDevicesNavigationSelection = Readonly<{
  spaceId: string | null;
  deviceId: string | null;
}>;

@Injectable({ providedIn: 'root' })
export class SpaceDevicesNavigationStateService {
  private static readonly lastSelectionStorageKey = 'clair.spaceDevices.lastSelection';

  readSelectionFromQueryParams(params: ParamMap): SpaceDevicesNavigationSelection | null {
    const deviceId = params.get('deviceId');
    const spaceId = params.get('spaceId');
    if (!deviceId && !spaceId) return null;

    return Object.freeze({
      spaceId: spaceId && spaceId.trim().length > 0 ? spaceId : null,
      deviceId: deviceId && deviceId.trim().length > 0 ? deviceId : null,
    });
  }

  readSelectionFromLocalStorage(): SpaceDevicesNavigationSelection | null {
    const raw = localStorage.getItem(SpaceDevicesNavigationStateService.lastSelectionStorageKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;

      const obj = parsed as { spaceId?: unknown; deviceId?: unknown };
      const spaceId = typeof obj.spaceId === 'string' && obj.spaceId.trim().length > 0 ? obj.spaceId : null;
      const deviceId = typeof obj.deviceId === 'string' && obj.deviceId.trim().length > 0 ? obj.deviceId : null;

      if (!spaceId && !deviceId) return null;
      return Object.freeze({ spaceId, deviceId });
    } catch {
      return null;
    }
  }

  persistSelectionToLocalStorage(selection: SpaceDevicesNavigationSelection): void {
    localStorage.setItem(SpaceDevicesNavigationStateService.lastSelectionStorageKey, JSON.stringify(selection));
  }

  clearLocalStorageSelection(): void {
    localStorage.removeItem(SpaceDevicesNavigationStateService.lastSelectionStorageKey);
  }

  syncQueryParams(
    router: Router,
    route: ActivatedRoute,
    params: Partial<SpaceDevicesNavigationSelection>,
    replaceUrl: boolean = false
  ): void {
    router.navigate([], {
      relativeTo: route,
      queryParams: {
        spaceId: params.spaceId,
        deviceId: params.deviceId,
      },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}

