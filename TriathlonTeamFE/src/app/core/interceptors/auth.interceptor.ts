import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

/**
 * AuthInterceptor - Handles authentication for API requests using HttpOnly cookies
 * Implements silent refresh logic for 401 errors.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private injector: Injector) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Be robust to absolute/relative URLs and always compute a pathname
    let path = req.url;
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      path = new URL(req.url, base).pathname;
    } catch {
      // leave path as-is
    }

    // Allow callers to explicitly skip auth
    if (req.headers.has('X-Skip-Auth')) {
      const clean = req.clone({ headers: req.headers.delete('X-Skip-Auth') });
      return next.handle(clean);
    }

    let authReq = req;
    // For API calls, enable credentials to send HttpOnly cookie
    if (path.startsWith('/api/')) {
      authReq = req.clone({
        withCredentials: true
      });
    }

    return next.handle(authReq).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // Ignore 401s for public endpoints or auth endpoints themselves to avoid loops
          if (req.url.includes('/api/auth/login') ||
            req.url.includes('/api/auth/refresh') ||
            req.url.includes('/api/auth/register') ||
            req.url.includes('/api/auth/me') ||
            path.startsWith('/api/public')) {
            return throwError(() => error);
          }
          return this.handle401Error(authReq, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const authService = this.injector.get(AuthService);
      const router = this.injector.get(Router);

      return authService.refreshToken().pipe(
        switchMap((token: any) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(token || true);
          return next.handle(request);
        }),
        catchError((err) => {
          this.isRefreshing = false;
          authService.clearAuthState();
          void router.navigate(['/login']);
          return throwError(() => err);
        })
      );
    } else {
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(() => {
          return next.handle(request);
        })
      );
    }
  }
}
