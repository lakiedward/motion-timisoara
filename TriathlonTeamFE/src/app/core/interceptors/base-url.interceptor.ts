import { Inject, Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable()
export class BaseUrlInterceptor implements HttpInterceptor {
  constructor(@Inject(API_BASE_URL) private readonly apiBaseUrl: string) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only prefix relative API calls starting with /api/
    if (req.url.startsWith('/api/')) {
      const base = this.apiBaseUrl.replace(/\/$/, '');
      const url = `${base}${req.url}`;
      return next.handle(req.clone({ url }));
    }
    return next.handle(req);
  }
}


