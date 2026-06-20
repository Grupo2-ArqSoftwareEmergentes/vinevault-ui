import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { StorageService } from '../../services/storage/storage';

const AUTH_ENDPOINTS = ['/api/v1/iam/login', '/api/v1/iam/register', '/api/v1/iam/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(StorageService);
  const token =
    storage.get<string>('access_token') ??
    storage.get<string>('accessToken');
  const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => req.url.includes(endpoint));

  if (!token || isAuthEndpoint) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    })
  );
};
