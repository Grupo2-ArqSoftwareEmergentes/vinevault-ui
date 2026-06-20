import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateWineCellarResource } from '../../../interfaces/rest/resources/create-wine-cellar.resource';
import { LinkDeviceToWineCellarResource } from '../../../interfaces/rest/resources/link-device-to-wine-cellar.resource';
import { UpdateWineCellarResource } from '../../../interfaces/rest/resources/update-wine-cellar.resource';
import { WineCellarCollectionResource, WineCellarResource } from '../../../interfaces/rest/resources/wine-cellar.resource';

export interface WineCellarGateway {
  getWineCellarsBySpace(spaceId: string): Observable<WineCellarCollectionResource>;
  createWineCellar(spaceId: string, resource: CreateWineCellarResource): Observable<WineCellarResource>;
  updateWineCellar(wineCellarId: string, resource: UpdateWineCellarResource): Observable<WineCellarResource>;
  deleteWineCellar(wineCellarId: string): Observable<void>;
  linkDevice(wineCellarId: string, resource: LinkDeviceToWineCellarResource): Observable<WineCellarResource>;
  unlinkDevice(wineCellarId: string, deviceId: string): Observable<WineCellarResource>;
}

export const WINE_CELLAR_GATEWAY = new InjectionToken<WineCellarGateway>('WINE_CELLAR_GATEWAY');
