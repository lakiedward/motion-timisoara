import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly router = inject(Router);

  handleError(error: unknown): void {
    try {
      const currentUrl = (() => {
        try {
          return this.router.url;
        } catch {
          return '';
        }
      })();

      const err: any = error;
      const message = (err && typeof err.message === 'string') ? err.message : String(error);
      const stack = (err && typeof err.stack === 'string') ? err.stack : undefined;

      // Ignore benign browser noise from ResizeObserver loops
      if (typeof message === 'string' && /resizeobserver loop/i.test(message)) {
        return;
      }

      // eslint-disable-next-line no-console
      console.error('[GlobalErrorHandler]', {
        url: currentUrl,
        message,
        stack,
        error: err
      });
    } catch {
      // Best-effort logging; avoid throwing from the handler
    }
  }
}
