import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SessionAccessService } from '../../services/session-access.service';
import { API_CONFIG } from '../../../api.config';
import { quotaErrorDetail } from '../../../shared/services/workspace-quota';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private sessionAccess: SessionAccessService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (req.url.startsWith(API_CONFIG.baseUrl + '/api/v1/') && !/\/iam\/(login|register|refresh)/.test(req.url)) {
          const quota = quotaErrorDetail(error);
          if (quota) this.sessionAccess.handleQuota(quota.message, req.url);
          else this.sessionAccess.handle(error.status, req.url);
        }
        return throwError(() => error);
      })
    );
  }
}
