import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { takeUntil } from 'rxjs';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { API_CONFIG, apiUrl } from '../../../api.config';

export const workspaceInterceptor: HttpInterceptorFn = (request, next) => {
  const scope = inject(WorkspaceScopeService);
  const root = apiUrl('/api/v1/');
  const globalRequest = /\/(iam\/|user\/context|user\/onboarding)/.test(request.url) ||
    (request.method === 'POST' && request.url.split('?')[0] === apiUrl(API_CONFIG.endpoints.spaces));
  if (!request.url.startsWith(root) || /\/iam\//.test(request.url)) return next(request);
  if (globalRequest) return next(request).pipe(takeUntil(scope.sessionChanged));
  // Unsubscribing aborts Angular's fetch/XHR transport; never retry a cancelled mutation.
  return next(request).pipe(takeUntil(scope.changed));
};
