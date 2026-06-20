import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { WineCellar, WineCellarQueryService } from '../../../domain/services/wine-cellar-query-service';
import { WineCellarHttpGateway } from '../../../infrastructure/api/gateways/wine-cellar-http.gateway';
import { wineCellarsResourceToDomain } from '../../../interfaces/rest/transform/wine-cellar.transform';

@Injectable({ providedIn: 'root' })
export class WineCellarQueryServiceImpl extends WineCellarQueryService {
  constructor(private readonly gateway: WineCellarHttpGateway) {
    super();
  }

  override getWineCellarsBySpace(spaceId: string): Observable<readonly WineCellar[]> {
    return this.gateway.getWineCellarsBySpace(spaceId).pipe(map(wineCellarsResourceToDomain));
  }
}
