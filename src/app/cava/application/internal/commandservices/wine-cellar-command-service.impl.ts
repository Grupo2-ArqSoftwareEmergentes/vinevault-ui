import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  CreateWineCellarPayload,
  UpdateWineCellarPayload,
  WineCellarCommandService,
} from '../../../domain/services/wine-cellar-command-service';
import { WineCellar } from '../../../domain/services/wine-cellar-query-service';
import { WineCellarHttpGateway } from '../../../infrastructure/api/gateways/wine-cellar-http.gateway';
import { LinkDeviceToWineCellarResource } from '../../../interfaces/rest/resources/link-device-to-wine-cellar.resource';
import { wineCellarResourceToDomain } from '../../../interfaces/rest/transform/wine-cellar.transform';

@Injectable({ providedIn: 'root' })
export class WineCellarCommandServiceImpl extends WineCellarCommandService {
  constructor(private readonly gateway: WineCellarHttpGateway) {
    super();
  }

  override createWineCellar(spaceId: string, payload: CreateWineCellarPayload): Observable<WineCellar> {
    return this.gateway.createWineCellar(spaceId, this.toResource(payload)).pipe(map(wineCellarResourceToDomain));
  }

  override updateWineCellar(wineCellarId: string, payload: UpdateWineCellarPayload): Observable<WineCellar> {
    return this.gateway.updateWineCellar(wineCellarId, this.toResource(payload)).pipe(map(wineCellarResourceToDomain));
  }

  override deleteWineCellar(wineCellarId: string): Observable<void> {
    return this.gateway.deleteWineCellar(wineCellarId);
  }

  override linkDevice(wineCellarId: string, deviceId: string): Observable<WineCellar> {
    const resource: LinkDeviceToWineCellarResource = { device_id: deviceId };
    return this.gateway.linkDevice(wineCellarId, resource).pipe(map(wineCellarResourceToDomain));
  }

  override unlinkDevice(wineCellarId: string, deviceId: string): Observable<WineCellar> {
    return this.gateway.unlinkDevice(wineCellarId, deviceId).pipe(map(wineCellarResourceToDomain));
  }

  private toResource(payload: CreateWineCellarPayload) {
    return {
      name: payload.name,
      description: payload.description,
    };
  }
}
