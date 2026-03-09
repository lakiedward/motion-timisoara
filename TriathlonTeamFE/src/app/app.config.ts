import { ApplicationConfig, APP_INITIALIZER, LOCALE_ID, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, ErrorHandler } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withFetch } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeRo from '@angular/common/locales/ro';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './core/tokens/supabase.token';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { GlobalErrorHandler } from './core/errors/global-error.handler';
import { WebSocketService } from './core/services/websocket.service';

import { routes } from './app.routes';
import { HttpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { LoadingInterceptor } from './core/interceptors/loading.interceptor';

registerLocaleData(localeRo);

function disableStripeAdvancedFraudSignals(): void {
  if (typeof window !== 'undefined') {
    (window as any).__STRIPE_DISABLE_ADVANCED_FRAUD_SIGNALS__ = true;
  }
}
disableStripeAdvancedFraudSignals();

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'ro-RO' },
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: (wsService: WebSocketService) => () => {
        // WebSocketService constructor handles auto-connect logic
      },
      deps: [WebSocketService],
      multi: true,
    },
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    // Supabase configuration
    {
      provide: SUPABASE_URL,
      useFactory: () => {
        if (typeof document !== 'undefined') {
          const meta = document.querySelector('meta[name="supabase-url"]') as HTMLMetaElement | null;
          return meta?.content || 'https://your-project.supabase.co';
        }
        return process?.env?.['SUPABASE_URL'] || 'https://your-project.supabase.co';
      },
    },
    {
      provide: SUPABASE_ANON_KEY,
      useFactory: () => {
        if (typeof document !== 'undefined') {
          const meta = document.querySelector('meta[name="supabase-anon-key"]') as HTMLMetaElement | null;
          return meta?.content || '';
        }
        return process?.env?.['SUPABASE_ANON_KEY'] || '';
      },
    },
    provideAnimations(),
    importProvidersFrom(MatSnackBarModule),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpErrorInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true,
    },
  ],
};
