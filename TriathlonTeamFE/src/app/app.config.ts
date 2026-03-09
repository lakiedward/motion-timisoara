import { ApplicationConfig, APP_INITIALIZER, LOCALE_ID, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, ErrorHandler } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withFetch } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeRo from '@angular/common/locales/ro';
import { API_BASE_URL } from './core/tokens/api-base-url.token';
import { BaseUrlInterceptor } from './core/interceptors/base-url.interceptor';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { GlobalErrorHandler } from './core/errors/global-error.handler';
import { WebSocketService } from './core/services/websocket.service';

import { routes } from './app.routes';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { CsrfInterceptor } from './core/interceptors/csrf.interceptor';
import { HttpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { LoadingInterceptor } from './core/interceptors/loading.interceptor';

// Register Romanian locale data
registerLocaleData(localeRo);

// Disable Stripe advanced fraud signals globally to prevent "Application not found" error
// This happens when reCAPTCHA domain is not configured in Stripe Dashboard
function disableStripeAdvancedFraudSignals(): void {
  if (typeof window !== 'undefined') {
    // @stripe/stripe-js looks for this before loading reCAPTCHA
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
    // ✅ Initialize WebSocket service on app bootstrap
    {
      provide: APP_INITIALIZER,
      useFactory: (wsService: WebSocketService) => () => {
        // WebSocketService constructor handles auto-connect logic
        // This just ensures the service is instantiated early
        console.log('✅ WebSocket service initialized');
      },
      deps: [WebSocketService],
      multi: true,
    },
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    ),
    // Disable event replay to avoid blocking interactions when hydration is delayed
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    {
      provide: API_BASE_URL,
      useFactory: () => {
        const normalize = (value: string | undefined): string => {
          const v = (value || '').trim().replace(/\/$/, '');
          if (!v) return '';
          let out = v;
          if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(out)) {
            const isLocal = /^(localhost|127\.0\.0\.1)(:?\d+)?(\/|$)/i.test(out);
            out = `${isLocal ? 'http' : 'https'}://${out}`;
          }
          try {
            new URL(out);
            return out;
          } catch {
            return '';
          }
        };
        // Browser branch
        if (typeof document !== 'undefined') {
          // 1) Runtime value from meta tag if present
          const meta = document.querySelector('meta[name="api-base-url"]') as HTMLMetaElement | null;
          const fromMeta = normalize(meta?.content);
          if (fromMeta) return fromMeta;

          // 2) Runtime env injected on window (optional)
          const fromEnvBrowser = normalize((window as any)["NG_APP_API_BASE_URL"] as string | undefined);
          if (fromEnvBrowser) return fromEnvBrowser;

          // 3) Fallback for browser: same-origin (proxy/local dev)
          return '';
        }

        // SSR branch (no document): try global/env variables
        const fromGlobal = normalize((globalThis as any)?.NG_APP_API_BASE_URL as string | undefined);
        if (fromGlobal) return fromGlobal;

        const fromProcess = normalize(typeof process !== 'undefined'
          ? (process.env?.['NG_APP_API_BASE_URL'] as string | undefined)
          : undefined);
        if (fromProcess) return fromProcess;

        // Final SSR fallback: use production backend to avoid same-origin /api during SSR
        return 'https://triathlonteambe-production.up.railway.app';
      },
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpErrorInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: BaseUrlInterceptor,
      multi: true,
    },
    provideAnimations(),
    importProvidersFrom(MatSnackBarModule),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CsrfInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true,
    },
  ],
};
