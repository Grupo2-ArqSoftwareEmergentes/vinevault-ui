import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../../api.config';
import { WineAiAutocompleteResponse } from '../../interfaces/rest/resources/wine-ai-autocomplete.resource';

export type { WineAiAutocompleteResponse } from '../../interfaces/rest/resources/wine-ai-autocomplete.resource';

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);

  autocompleteWine(wineName: string): Observable<WineAiAutocompleteResponse> {
    return this.http.post<WineAiAutocompleteResponse>(API_CONFIG.baseUrl + API_CONFIG.endpoints.autocompleteWine, { wine_name: wineName });
  }
}
