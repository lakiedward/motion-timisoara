import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';

/**
 * CSRF token helper.
 *
 * Our backend uses CookieCsrfTokenRepository and exposes the token at GET /api/auth/csrf.
 * This service caches the token in-memory and allows force-refresh.
 */
@Injectable({ providedIn: 'root' })
export class CsrfService {
  private token$?: Observable<string>;

  constructor(private readonly http: HttpClient) {}

  getToken(forceRefresh = false): Observable<string> {
    if (!forceRefresh && this.token$) {
      return this.token$;
    }

    this.token$ = this.http.get<{ token: string }>('/api/auth/csrf').pipe(
      map((res) => (res?.token ?? '').trim()),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.token$;
  }

  clear(): void {
    this.token$ = undefined;
  }
}





