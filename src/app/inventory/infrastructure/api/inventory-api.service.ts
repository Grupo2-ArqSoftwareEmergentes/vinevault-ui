import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { API_CONFIG } from '../../../api.config';
import { WineAiAutocompleteResponse } from '../../interfaces/rest/resources/wine-ai-autocomplete.resource';

export type { WineAiAutocompleteResponse } from '../../interfaces/rest/resources/wine-ai-autocomplete.resource';

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly scope = inject(WorkspaceScopeService);

  autocompleteWine(wineName: string): Observable<WineAiAutocompleteResponse> {
    const spaceId = this.scope.space()?.id.value;
    if (!spaceId) return throwError(() => new Error('Selecciona un espacio antes de autocompletar.'));
    return this.http.post<WineAiAutocompleteResponse>(API_CONFIG.baseUrl + API_CONFIG.endpoints.autocompleteWine, { wine_name: wineName }, { params: { space_id: spaceId } });
  }
}
