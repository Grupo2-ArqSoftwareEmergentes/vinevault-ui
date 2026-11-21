import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_CONFIG } from '../../../api.config';
import { WorkspaceContextService } from '../../../shared/services/workspace-context.service';

/** Space/cellar mutations refresh in their orchestrators; inventory mutations do so here. */
export const inventoryQuotaRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const injector = inject(Injector);
  const mutation = request.url.startsWith(API_CONFIG.baseUrl + '/api/v1/wine-cellars/') &&
    /\/inventory(?:\/|\?|$)/.test(request.url) && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method);
  return next(request).pipe(tap(event => {
    if (mutation && event instanceof HttpResponse) injector.get(WorkspaceContextService).refresh();
  }));
};
