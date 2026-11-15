import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_CONFIG } from '../../api.config';
import { UserContextResource, WorkspaceDirectory, WorkspaceSpace } from '../models/workspace-context';
import { createSpaceId } from '../../device/domain/model/valueobjects/space-id.value-object';
import { createWineCellarId } from '../../cava/domain/model/valueobjects/wine-cellar-id.value-object';
import { extractApiErrorMessage } from '../../device/interfaces/rest/transform/extract-api-error-message.transform';

const toSpace = (resource: { id: string; name: string }): WorkspaceSpace => ({ id: createSpaceId(resource.id), name: resource.name });

@Injectable({ providedIn: 'root' })
export class WorkspaceApiService {
  private readonly http = inject(HttpClient);
  private readonly spacesUrl = API_CONFIG.baseUrl + API_CONFIG.endpoints.spaces;

  getContext(): Observable<WorkspaceDirectory> {
    return this.http.get<UserContextResource>(API_CONFIG.baseUrl + API_CONFIG.endpoints.userContext).pipe(map((resource) => ({
      spaces: resource.spaces.map(toSpace),
      cellars: resource.wine_cellars.map((cellar) => ({ id: createWineCellarId(cellar.id), name: cellar.name, spaceId: createSpaceId(cellar.space_id) })),
    })));
  }

  getSpaces(): Observable<readonly WorkspaceSpace[]> {
    return this.http.get<{ id: string; name: string }[]>(this.spacesUrl).pipe(map((spaces) => spaces.map(toSpace)));
  }

  createSpace(name: string): Observable<WorkspaceSpace> {
    return this.http.post<{ id: string; name: string }>(this.spacesUrl, { name: name.trim() }).pipe(map(toSpace));
  }
}

export function workspaceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 401: return 'Your session has expired. Please sign in again.';
      case 403: return 'You do not have permission to access this workspace.';
      case 404: return 'This space or cellar no longer exists. Refresh your workspaces.';
      case 409: return extractApiErrorMessage(error, 'The space limit has been reached or this change conflicts with existing data.');
      case 422: return extractApiErrorMessage(error, 'Check the name and selected space, then try again.');
    }
  }
  return extractApiErrorMessage(error, fallback);
}
