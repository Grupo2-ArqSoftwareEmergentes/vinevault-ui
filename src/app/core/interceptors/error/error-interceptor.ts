import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SessionAccessService } from '../../services/session-access.service';
import { API_CONFIG, apiUrl } from '../../../api.config';
import { apiErrorDetail, planFeatureUnavailableDetail, quotaErrorDetail } from '../../../shared/services/workspace-quota';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private sessionAccess: SessionAccessService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (req.url.startsWith(apiUrl('/api/v1/')) && !/\/iam\/(login|register|refresh)/.test(req.url)) {
          const cleanUrl = req.url.split('?')[0];
          // Billing denials are business errors, not revoked membership or a dead session.
          if (error.status !== 401 && cleanUrl.startsWith(apiUrl('/api/v1/subscriptions/'))) return throwError(() => error);
          // An optional export denial is shown locally; it must not dismiss the error dialog by resetting context.
          if (error.status === 403 && req.method === 'GET' && cleanUrl === apiUrl(API_CONFIG.endpoints.exportInventory)) return throwError(() => error);
          // This permission denial belongs to the optional AI assistant, not space membership.
          if (error.status === 403 && req.method === 'POST' && [API_CONFIG.endpoints.autocompleteWine, API_CONFIG.endpoints.assistantChat].some(path => cleanUrl === apiUrl(path))) return throwError(() => error);

          // Wrong current password returns 401 INVALID_CURRENT_PASSWORD; handle locally without logging out.
          if (error.status === 401 && req.method === 'POST' && cleanUrl === apiUrl(API_CONFIG.endpoints.profileChangePassword)) {
            const detail = apiErrorDetail(error);
            if (detail?.code === 'INVALID_CURRENT_PASSWORD') return throwError(() => error);
          }

          const quota = quotaErrorDetail(error);
          if (quota) {
            this.sessionAccess.handleQuota(quota.message, req.url, quota.code, quota.current, quota.limit);
            return throwError(() => error);
          }

          const planUnavailable = planFeatureUnavailableDetail(error);
          if (planUnavailable) {
            this.sessionAccess.handlePlanFeatureUnavailable(planUnavailable.message);
            return throwError(() => error);
          }

          if (error.status === 403 && apiErrorDetail(error)?.code === 'FORBIDDEN') {
            this.sessionAccess.handleInsufficientSpacePermission(apiErrorDetail(error)?.message ?? '');
            return throwError(() => error);
          }

          this.sessionAccess.handle(error.status, req.url);
        }
        return throwError(() => error);
      })
    );
  }
}
