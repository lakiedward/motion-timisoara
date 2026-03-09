import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { CsrfService } from '../services/csrf.service';

/**
 * Adds X-XSRF-TOKEN for unsafe API requests (POST/PUT/PATCH/DELETE).
 *
 * This is required when the app is configured with an absolute API base URL (cross-origin),
 * because Angular's built-in XSRF interceptor intentionally skips absolute URLs.
 */
@Injectable()
export class CsrfInterceptor implements HttpInterceptor {
  constructor(private readonly csrfService: CsrfService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Allow callers to explicitly skip CSRF handling
    if (req.headers.has('X-Skip-Csrf')) {
      const clean = req.clone({ headers: req.headers.delete('X-Skip-Csrf') });
      return next.handle(clean);
    }

    // Only apply to unsafe HTTP methods
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'TRACE') {
      return next.handle(req);
    }

    // Compute pathname from absolute/relative URL
    let path = req.url;
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      path = new URL(req.url, base).pathname;
    } catch {
      // leave path as-is
    }

    // Only for API calls
    if (!path.startsWith('/api/')) {
      return next.handle(req);
    }

    // These endpoints are explicitly CSRF-ignored server-side; avoid extra round-trips.
    // (Keeping this list here makes login/registration snappier.)
    const csrfIgnored = new Set<string>([
      '/api/auth/login',
      '/api/auth/register-parent',
      '/api/auth/register-coach',
      '/api/auth/register-club',
      '/api/auth/validate-club-code',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/auth/csrf',
    ]);
    if (csrfIgnored.has(path)) {
      return next.handle(req);
    }

    // If already set (e.g., same-origin Angular XSRF), don't override.
    if (req.headers.has('X-XSRF-TOKEN')) {
      return next.handle(req);
    }

    const attachAndSend = (token: string): Observable<HttpEvent<any>> => {
      const t = (token || '').trim();
      if (!t) {
        return next.handle(req);
      }
      return next.handle(req.clone({ headers: req.headers.set('X-XSRF-TOKEN', t) }));
    };

    // Load token once and attach; on 403, refresh token once and retry.
    return this.csrfService.getToken().pipe(
      switchMap((token) => attachAndSend(token)),
      catchError((err: unknown) => {
        const httpErr = err as HttpErrorResponse;
        const alreadyRetried = req.headers.has('X-CSRF-Retry');
        if (httpErr?.status === 403 && !alreadyRetried) {
          return this.csrfService.getToken(true).pipe(
            switchMap((token) =>
              next.handle(
                req.clone({
                  headers: req.headers
                    .set('X-CSRF-Retry', '1')
                    .set('X-XSRF-TOKEN', (token || '').trim()),
                })
              )
            )
          );
        }
        return throwError(() => err);
      })
    );
  }
}





