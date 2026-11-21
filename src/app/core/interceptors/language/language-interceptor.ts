import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';
import { API_CONFIG } from '../../../api.config';

export const languageInterceptor: HttpInterceptorFn = (request, next) => {
  const language = inject(I18nService).language();
  return next(
    request.url.startsWith(API_CONFIG.baseUrl + '/')
      ? request.clone({ setHeaders: { 'Accept-Language': language } })
      : request,
  );
};
