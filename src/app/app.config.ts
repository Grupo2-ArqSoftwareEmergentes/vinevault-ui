import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { DEVICE_COMMAND_SERVICE } from './device/domain/services/device-command-service';
import { DEVICE_QUERY_SERVICE } from './device/domain/services/device-query-service';
import { DEVICE_STATUS_QUERY_SERVICE } from './device/domain/services/device-status-query-service';
import { DEVICE_THRESHOLD_COMMAND_SERVICE } from './device/domain/services/device-threshold-command-service';
import { DEVICE_THRESHOLD_QUERY_SERVICE } from './device/domain/services/device-threshold-query-service';
import { DeviceCommandServiceImpl } from './device/application/internal/commandservices/device-command-service.impl';
import { DeviceQueryServiceImpl } from './device/application/internal/queryservices/device-query-service.impl';
import { DeviceStatusQueryServiceImpl } from './device/application/internal/queryservices/device-status-query-service.impl';
import { DeviceThresholdCommandServiceImpl } from './device/application/internal/commandservices/device-threshold-command-service.impl';
import { DeviceThresholdQueryServiceImpl } from './device/application/internal/queryservices/device-threshold-query-service.impl';
import { EVALUATION_CONTEXT_FACADE } from './evaluation/interfaces/acl/evaluation-context-facade';

// Interceptors
import { authInterceptor } from './core/interceptors/auth/auth-interceptor';
import { ErrorInterceptor } from './core/interceptors/error/error-interceptor';
import { NoopEvaluationContextFacade } from './evaluation/infrastructure/acl/noop-evaluation-context-facade';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      withInterceptorsFromDi()
    ),
    provideAnimations(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true
    },
    {
      provide: DEVICE_QUERY_SERVICE,
      useClass: DeviceQueryServiceImpl
    },
    {
      provide: DEVICE_COMMAND_SERVICE,
      useClass: DeviceCommandServiceImpl
    },
    {
      provide: DEVICE_STATUS_QUERY_SERVICE,
      useClass: DeviceStatusQueryServiceImpl
    },
    {
      provide: DEVICE_THRESHOLD_QUERY_SERVICE,
      useClass: DeviceThresholdQueryServiceImpl
    },
    {
      provide: DEVICE_THRESHOLD_COMMAND_SERVICE,
      useClass: DeviceThresholdCommandServiceImpl
    },
    {
      provide: EVALUATION_CONTEXT_FACADE,
      useClass: NoopEvaluationContextFacade
    }
  ]
};
