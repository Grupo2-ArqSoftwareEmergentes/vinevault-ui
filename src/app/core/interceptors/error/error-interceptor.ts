import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SessionAccessService } from '../../services/session-access.service';
import { API_CONFIG, apiUrl } from '../../../api.config';
import { quotaErrorDetail } from '../../../shared/services/workspace-quota';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private sessionAccess: SessionAccessService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (req.url.startsWith(apiUrl('/api/v1/')) && !/\/iam\/(login|register|refresh)/.test(req.url)) {
          // An optional export denial is shown locally; it must not dismiss the error dialog by resetting context.
          if (error.status === 403 && req.method === 'GET' && req.url.split('?')[0] === apiUrl(API_CONFIG.endpoints.exportInventory)) return throwError(() => error);
          // This permission denial belongs to the optional AI assistant, not space membership.
          if (error.status === 403 && req.method === 'POST' && [API_CONFIG.endpoints.autocompleteWine, API_CONFIG.endpoints.assistantChat].some(path => req.url.split('?')[0] === apiUrl(path))) return throwError(() => error);
          const quota = quotaErrorDetail(error);
          if (quota) this.sessionAccess.handleQuota(quota.message, req.url, quota.code);
          else this.sessionAccess.handle(error.status, req.url);
        }
        return throwError(() => error);
      })
    );
  }
}
