import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';
import { LOGISTICA_SERVER_URL } from './core/services/logistica-api.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOGISTICA_SERVER_URL, useValue: 'http://localhost:5289' },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
  ],
};
