import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { inject, Injectable, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorSnackbarService } from '../../shared/services/error-snackbar.service';
import { AuthService } from '../services/auth.service';

const TOKEN_KEY = 'access_token';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  private readonly snackbar = inject(ErrorSnackbarService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          // Dev-only debug for admin endpoints
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - ngDevMode is a build-time Angular flag
          if (typeof ngDevMode !== 'undefined' && ngDevMode && req.url.includes('/api/admin/')) {
            // eslint-disable-next-line no-console
            console.debug('[HttpErrorInterceptor]', {
              url: req.url,
              status: error.status,
              message: error.message,
              error: error.error
            });
          }
          if (error.status === 401) {
            // 401 errors are now handled by AuthInterceptor which implements silent refresh
            // We only ignore them here to prevent duplicate handling or premature logout
          } else if (error.status === 403) {
            // Only show snackbar for non-GET/HEAD requests (write operations)
            // GET 403s are often handled by UI components (teasers/empty states)
            if (req.method !== 'GET' && req.method !== 'HEAD') {
              this.snackbar.show('Nu aveti permisiuni pentru aceasta actiune.');
            }
          } else if (error.status === 400) {
            const message = this.collectBadRequestMessages(error);
            this.snackbar.show(message);
          } else {
            const message = this.resolveMessage(error);
            if (message) {
              this.snackbar.show(message);
            }
          }
        }
        return throwError(() => error);
      })
    );
  }

  private collectBadRequestMessages(error: HttpErrorResponse): string {
    const payload = error.error;
    const messages: string[] = [];

    if (payload?.errors) {
      const details = payload.errors;
      if (Array.isArray(details)) {
        details.forEach((entry: unknown) => {
          if (typeof entry === 'string') {
            messages.push(entry);
          } else if (entry && typeof entry === 'object' && 'message' in entry) {
            messages.push(String((entry as { message: unknown }).message));
          }
        });
      } else if (typeof details === 'object') {
        Object.values(details).forEach((value) => {
          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (typeof item === 'string') {
                messages.push(item);
              }
            });
          } else if (typeof value === 'string') {
            messages.push(value);
          }
        });
      }
    }

    if (messages.length === 0 && typeof payload?.message === 'string') {
      messages.push(payload.message);
    }

    if (messages.length === 0) {
      messages.push('Solicitarea nu a putut fi procesata. Verifica datele si incearca din nou.');
    }

    return messages.join('\n');
  }

  private resolveMessage(error: HttpErrorResponse): string {
    const payload = error.error as unknown;
    const status = error.status;
    const headers = (error as HttpErrorResponse).headers;
    const contentType = headers && typeof headers.get === 'function' ? (headers.get('Content-Type') || '') : '';
    const messageText = typeof error.message === 'string' ? error.message : '';

    const isNetworkOrParsing =
      status === 0 ||
      /Http failure during parsing/i.test(messageText) ||
      /Unexpected token|is not valid JSON/i.test(messageText);
    if (isNetworkOrParsing) {
      return '';
    }

    if (contentType.toLowerCase().includes('text/html')) {
      return '';
    }
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      const looksLikeHtml = trimmed.startsWith('<');
      const looksLikeJsonParseError = /Unexpected token|is not valid JSON/i.test(trimmed);
      if (looksLikeHtml || looksLikeJsonParseError) {
        // Suppress raw HTML or JSON parse noise
        return '';
      }
      return trimmed;
    }
    if (payload && typeof payload === 'object' && 'message' in (payload as Record<string, unknown>)) {
      const msg = String((payload as { message?: unknown }).message ?? '');
      if (/Unexpected token|is not valid JSON/i.test(msg)) {
        return '';
      }
      return msg;
    }
    return '';
  }
}
