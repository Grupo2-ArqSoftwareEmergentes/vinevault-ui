import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { takeUntil } from 'rxjs';
import { WorkspaceScopeService } from '../../../shared/services/workspace-scope.service';
import { API_CONFIG, apiUrl } from '../../../api.config';

export const workspaceInterceptor: HttpInterceptorFn = (request, next) => {
  const scope = inject(WorkspaceScopeService);
  const root = apiUrl('/api/v1/');
  const cleanUrl = request.url.split('?')[0];
  const isAccountSubscriptionRequest =
    cleanUrl === apiUrl(API_CONFIG.endpoints.subscriptionsCatalog) ||
    cleanUrl === apiUrl(API_CONFIG.endpoints.subscriptionRequests) ||
    cleanUrl === apiUrl(API_CONFIG.endpoints.subscriptionExtraSpaceRequests) ||
    (cleanUrl === apiUrl(API_CONFIG.endpoints.subscriptionsOverview) && !request.params.has('space_id') && !/[?&]space_id=/.test(request.url));
  const isAccountProfileRequest =
    cleanUrl === apiUrl(API_CONFIG.endpoints.profile) ||
    cleanUrl === apiUrl(API_CONFIG.endpoints.profileChangePassword);
  const globalRequest = /\/(iam\/|user\/context|user\/onboarding)/.test(request.url) ||
    (request.method === 'POST' && cleanUrl === apiUrl(API_CONFIG.endpoints.spaces)) ||
    isAccountSubscriptionRequest ||
    isAccountProfileRequest;
  if (!request.url.startsWith(root) || /\/iam\//.test(request.url)) return next(request);
  if (globalRequest) return next(request).pipe(takeUntil(scope.sessionChanged));
  // Unsubscribing aborts Angular's fetch/XHR transport; never retry a cancelled mutation.
  return next(request).pipe(takeUntil(scope.changed));
};
